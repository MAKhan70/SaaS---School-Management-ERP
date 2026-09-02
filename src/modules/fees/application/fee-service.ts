import { createHash, randomUUID } from "node:crypto";

import {
  AuditOutcome,
  AuditSensitivity,
  FeeAdjustmentKind,
  FeeAssignmentSource,
  FeeHeadKind,
  FeePaymentMethod,
  FeePaymentState,
  FeeRefundState,
  FinanceApprovalState,
  FinancialDirection,
  GatewayEventState,
  type Prisma,
  type PrismaClient,
} from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import type { RequestMetadata } from "@/modules/identity/domain/request-security";
import { requirePermission } from "@/server/authorization/authorize";
import { withTenant } from "@/server/database/tenant-context";

import {
  feeMutationSchema,
  feeWorkspaceQuerySchema,
  type FeeMutation,
} from "../domain/fee-contracts";
import {
  assertAllocationTotal,
  parseInrToMinor,
  sumMinor,
} from "../domain/money";
import {
  LocalSimulatedPaymentProvider,
  type PaymentProviderAdapter,
} from "./payment-provider";

type FeeScope = {
  trustId: string;
  schoolId: string;
  campusId: string;
  academicYearId: string;
};

function activeScope(context: AuthenticatedContext): FeeScope {
  if (!context.schoolId || !context.campusId || !context.academicYearId)
    throw new Error("Select a school, campus, and academic year");
  return {
    trustId: context.trustId,
    schoolId: context.schoolId,
    campusId: context.campusId,
    academicYearId: context.academicYearId,
  };
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
function indiaDay(value: string) {
  const startsAt = new Date(`${value}T00:00:00+05:30`);
  return { startsAt, endsAt: new Date(startsAt.getTime() + 86_400_000) };
}
function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function adjustmentDirection(kind: FeeAdjustmentKind) {
  return kind === FeeAdjustmentKind.LATE_FEE || kind === FeeAdjustmentKind.FINE
    ? FinancialDirection.DEBIT
    : FinancialDirection.CREDIT;
}

function audit(
  tx: Prisma.TransactionClient,
  context: AuthenticatedContext,
  metadata: RequestMetadata,
  action: string,
  resourceType: string,
  resourceId: string,
  changes?: Prisma.InputJsonValue,
) {
  return tx.auditEvent.create({
    data: {
      trustId: context.trustId,
      schoolId: context.schoolId,
      campusId: context.campusId,
      actorUserId: context.userId,
      effectiveActorUserId: context.userId,
      action,
      resourceType,
      resourceId,
      outcome: AuditOutcome.SUCCEEDED,
      sensitivity: AuditSensitivity.SENSITIVE,
      correlationId: metadata.correlationId,
      changes,
      metadata: {
        ...(metadata.ipHash ? { ipHash: metadata.ipHash } : {}),
        ...(metadata.userAgentHash
          ? { userAgentHash: metadata.userAgentHash }
          : {}),
      },
    },
  });
}

function financialAudit(
  tx: Prisma.TransactionClient,
  context: AuthenticatedContext,
  scope: FeeScope,
  metadata: RequestMetadata,
  input: {
    studentProfileId?: string;
    direction: FinancialDirection;
    amountMinor: number;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  return tx.financialAuditEntry.create({
    data: {
      ...scope,
      studentProfileId: input.studentProfileId,
      direction: input.direction,
      amountMinor: input.amountMinor,
      currency: "INR",
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      correlationId: metadata.correlationId,
      actorUserId: context.userId,
      metadata: input.metadata,
    },
  });
}

export class FeeService {
  constructor(
    private readonly client: PrismaClient,
    private readonly paymentProvider: PaymentProviderAdapter = new LocalSimulatedPaymentProvider(),
  ) {}

  async workspace(context: AuthenticatedContext, untrustedQuery: unknown) {
    const query = feeWorkspaceQuerySchema.parse(untrustedQuery);
    const scope = activeScope(context);
    requirePermission(
      context,
      query.report ? "finance.reports.read" : "finance.fees.read",
      scope,
    );
    return withTenant(
      this.client,
      {
        trustId: scope.trustId,
        actorUserId: context.userId,
        correlationId: randomUUID(),
      },
      async (tx) => {
        const studentWhere = query.studentProfileId
          ? { studentProfileId: query.studentProfileId }
          : {};
        const paidAt = {
          ...(query.from ? { gte: indiaDay(query.from).startsAt } : {}),
          ...(query.to ? { lt: indiaDay(query.to).endsAt } : {}),
        };
        if (
          query.from &&
          query.to &&
          paidAt.gte &&
          paidAt.lt &&
          paidAt.gte >= paidAt.lt
        )
          throw new Error(
            "The report end date must not precede the start date",
          );
        const [
          categories,
          structures,
          grades,
          sections,
          assignments,
          payments,
          pendingAdjustments,
          pendingRefunds,
          closures,
        ] = await Promise.all([
          tx.feeCategory.findMany({
            where: {
              trustId: scope.trustId,
              schoolId: scope.schoolId,
              archivedAt: null,
            },
            include: {
              heads: { where: { archivedAt: null }, orderBy: { name: "asc" } },
            },
            orderBy: { name: "asc" },
          }),
          tx.feeStructure.findMany({
            where: {
              trustId: scope.trustId,
              schoolId: scope.schoolId,
              academicYearId: scope.academicYearId,
              archivedAt: null,
            },
            include: {
              gradeClass: true,
              installments: {
                include: { lines: { include: { feeHead: true } } },
                orderBy: { sequence: "asc" },
              },
            },
            orderBy: [{ gradeClass: { level: "asc" } }, { name: "asc" }],
          }),
          tx.gradeClass.findMany({
            where: {
              trustId: scope.trustId,
              schoolId: scope.schoolId,
              archivedAt: null,
            },
            orderBy: { level: "asc" },
          }),
          tx.section.findMany({
            where: { ...scope, archivedAt: null },
            include: { gradeClass: true },
            orderBy: [{ gradeClass: { level: "asc" } }, { name: "asc" }],
          }),
          tx.studentFeeAssignment.findMany({
            where: { ...scope, ...studentWhere, archivedAt: null },
            include: {
              feeHead: true,
              studentProfile: {
                include: {
                  person: { select: { firstName: true, lastName: true } },
                },
              },
              adjustments: {
                where: { approvalState: FinanceApprovalState.APPROVED },
              },
              allocations: {
                include: { payment: { include: { reversal: true } } },
              },
            },
            orderBy: [{ dueOn: "asc" }, { createdAt: "asc" }],
          }),
          tx.feePayment.findMany({
            where: {
              ...scope,
              ...studentWhere,
              ...(Object.keys(paidAt).length ? { paidAt } : {}),
            },
            include: {
              receipt: true,
              reversal: true,
              refunds: true,
              allocations: true,
            },
            orderBy: { paidAt: "desc" },
            take: 100,
          }),
          tx.feeAdjustment.findMany({
            where: {
              trustId: scope.trustId,
              schoolId: scope.schoolId,
              approvalState: FinanceApprovalState.PENDING,
              assignment: { academicYearId: scope.academicYearId },
            },
            include: {
              assignment: {
                include: {
                  feeHead: true,
                  studentProfile: { include: { person: true } },
                },
              },
            },
            orderBy: { createdAt: "asc" },
          }),
          tx.feeRefund.findMany({
            where: {
              trustId: scope.trustId,
              schoolId: scope.schoolId,
              state: FeeRefundState.PENDING,
            },
            include: {
              payment: {
                include: {
                  receipt: true,
                  studentProfile: { include: { person: true } },
                },
              },
            },
            orderBy: { createdAt: "asc" },
          }),
          tx.dailyCollectionClosure.findMany({
            where: { ...scope },
            orderBy: { collectionDate: "desc" },
            take: 31,
          }),
        ]);

        const ledger = assignments.map((assignment) => {
          const adjustments = assignment.adjustments.reduce(
            (total, item) =>
              total +
              (item.direction === FinancialDirection.DEBIT
                ? item.amountMinor
                : -item.amountMinor),
            0,
          );
          const paid = assignment.allocations
            .filter((item) => !item.payment.reversal)
            .reduce((total, item) => total + item.amountMinor, 0);
          return {
            ...assignment,
            outstandingMinor: assignment.amountMinor + adjustments - paid,
          };
        });
        const outstandingMinor = sumMinor(
          ledger.map((item) => item.outstandingMinor),
        );
        const postedPayments = payments.filter(
          (payment) => payment.state === FeePaymentState.POSTED,
        );
        const collectionsByMethod = Object.values(FeePaymentMethod).map(
          (method) => ({
            method,
            amountMinor: sumMinor(
              postedPayments
                .filter((payment) => payment.method === method)
                .map((payment) => payment.amountMinor),
            ),
          }),
        );
        return {
          currency: "INR",
          categories,
          structures,
          grades,
          sections,
          ledger,
          payments,
          pendingAdjustments,
          pendingRefunds,
          closures: closures.map((item) => ({
            ...item,
            netMinor: item.netAmountMinor,
          })),
          reports: {
            outstandingMinor,
            collectionsMinor: sumMinor(
              postedPayments.map((payment) => payment.amountMinor),
            ),
            collectionsByMethod,
          },
        };
      },
    );
  }

  async mutate(
    context: AuthenticatedContext,
    untrustedInput: unknown,
    metadata: RequestMetadata,
  ) {
    const input = feeMutationSchema.parse(untrustedInput);
    const scope = activeScope(context);
    return withTenant(
      this.client,
      {
        trustId: scope.trustId,
        actorUserId: context.userId,
        correlationId: metadata.correlationId,
      },
      async (tx) => {
        switch (input.action) {
          case "category.create":
            return this.createCategory(tx, context, scope, input, metadata);
          case "head.create":
            return this.createHead(tx, context, scope, input, metadata);
          case "structure.create":
            return this.createStructure(tx, context, scope, input, metadata);
          case "assignment.create":
            return this.createAssignment(tx, context, scope, input, metadata);
          case "assignment.class.apply":
            return this.applyClassStructure(
              tx,
              context,
              scope,
              input,
              metadata,
            );
          case "adjustment.request":
            return this.requestAdjustment(tx, context, scope, input, metadata);
          case "adjustment.decide":
            return this.decideAdjustment(tx, context, scope, input, metadata);
          case "payment.post":
            return this.postPayment(tx, context, scope, input, metadata);
          case "payment.reverse":
            return this.reversePayment(tx, context, scope, input, metadata);
          case "refund.request":
            return this.requestRefund(tx, context, scope, input, metadata);
          case "refund.decide":
            return this.decideRefund(tx, context, scope, input, metadata);
          case "gateway.reconcile":
            return this.reconcile(tx, context, scope, input, metadata);
          case "collection.close":
            return this.closeCollection(tx, context, scope, input, metadata);
        }
      },
    );
  }

  private async createCategory(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: FeeScope,
    input: Extract<FeeMutation, { action: "category.create" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "finance.fees.manage", scope);
    const result = await tx.feeCategory.create({
      data: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        code: input.code,
        name: input.name,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "finance.category.created",
      "FeeCategory",
      result.id,
    );
    return result;
  }

  private async createHead(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: FeeScope,
    input: Extract<FeeMutation, { action: "head.create" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "finance.fees.manage", scope);
    await tx.feeCategory.findFirstOrThrow({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        id: input.categoryId,
        archivedAt: null,
      },
    });
    const result = await tx.feeHead.create({
      data: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        categoryId: input.categoryId,
        code: input.code,
        name: input.name,
        kind: input.kind as FeeHeadKind,
        refundable: input.refundable,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "finance.head.created",
      "FeeHead",
      result.id,
    );
    return result;
  }

  private async createStructure(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: FeeScope,
    input: Extract<FeeMutation, { action: "structure.create" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "finance.fees.manage", scope);
    await tx.gradeClass.findFirstOrThrow({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        id: input.gradeClassId,
        archivedAt: null,
      },
    });
    const structure = await tx.feeStructure.create({
      data: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        academicYearId: scope.academicYearId,
        gradeClassId: input.gradeClassId,
        code: input.code,
        name: input.name,
        version: input.version,
        currency: "INR",
        createdBy: context.userId,
      },
    });
    for (const [index, installmentInput] of input.installments.entries()) {
      const installment = await tx.feeInstallment.create({
        data: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          feeStructureId: structure.id,
          code: installmentInput.code,
          name: installmentInput.name,
          sequence: index + 1,
          dueOn: dateOnly(installmentInput.dueOn),
        },
      });
      for (const line of installmentInput.lines) {
        await tx.feeHead.findFirstOrThrow({
          where: {
            trustId: scope.trustId,
            schoolId: scope.schoolId,
            id: line.feeHeadId,
            archivedAt: null,
          },
        });
        await tx.feeStructureLine.create({
          data: {
            trustId: scope.trustId,
            schoolId: scope.schoolId,
            feeStructureId: structure.id,
            installmentId: installment.id,
            feeHeadId: line.feeHeadId,
            amountMinor: parseInrToMinor(line.amount),
          },
        });
      }
    }
    await audit(
      tx,
      context,
      metadata,
      "finance.structure.created",
      "FeeStructure",
      structure.id,
      { version: structure.version },
    );
    return structure;
  }

  private async createAssignment(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: FeeScope,
    input: Extract<FeeMutation, { action: "assignment.create" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "finance.fees.manage", scope);
    await tx.studentProfile.findFirstOrThrow({
      where: {
        trustId: scope.trustId,
        id: input.studentProfileId,
        enrollments: {
          some: {
            schoolId: scope.schoolId,
            academicYearId: scope.academicYearId,
          },
        },
      },
    });
    const head = await tx.feeHead.findFirstOrThrow({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        id: input.feeHeadId,
        archivedAt: null,
      },
    });
    const enrollment = await tx.studentEnrollment.findFirstOrThrow({
      where: {
        ...scope,
        id: input.enrollmentId,
        studentProfileId: input.studentProfileId,
      },
    });
    const amountMinor = parseInrToMinor(input.amount);
    const result = await tx.studentFeeAssignment.create({
      data: {
        ...scope,
        studentProfileId: input.studentProfileId,
        enrollmentId: input.enrollmentId,
        sectionId: enrollment.sectionId,
        feeHeadId: head.id,
        structureLineId: input.structureLineId,
        installmentId: input.installmentId,
        source: input.source as FeeAssignmentSource,
        description: input.description,
        amountMinor,
        dueOn: dateOnly(input.dueOn),
        createdBy: context.userId,
      },
    });
    await financialAudit(tx, context, scope, metadata, {
      studentProfileId: result.studentProfileId,
      direction: FinancialDirection.DEBIT,
      amountMinor,
      action: "fee.assigned",
      resourceType: "StudentFeeAssignment",
      resourceId: result.id,
    });
    await audit(
      tx,
      context,
      metadata,
      "finance.assignment.created",
      "StudentFeeAssignment",
      result.id,
      { amountMinor, currency: "INR" },
    );
    return result;
  }

  private async applyClassStructure(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: FeeScope,
    input: Extract<FeeMutation, { action: "assignment.class.apply" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "finance.fees.manage", scope);
    const section = await tx.section.findFirstOrThrow({
      where: { ...scope, id: input.sectionId, archivedAt: null },
    });
    const structure = await tx.feeStructure.findFirstOrThrow({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        academicYearId: scope.academicYearId,
        gradeClassId: section.gradeClassId,
        id: input.feeStructureId,
        archivedAt: null,
      },
      include: {
        lines: {
          where: { optional: false, status: "ACTIVE" },
          include: { installment: true, feeHead: true },
        },
      },
    });
    const enrollments = await tx.studentEnrollment.findMany({
      where: { ...scope, sectionId: section.id, status: "ACTIVE" },
    });
    let createdCount = 0;
    for (const enrollment of enrollments) {
      for (const line of structure.lines) {
        const existing = await tx.studentFeeAssignment.findFirst({
          where: {
            trustId: scope.trustId,
            schoolId: scope.schoolId,
            academicYearId: scope.academicYearId,
            studentProfileId: enrollment.studentProfileId,
            structureLineId: line.id,
          },
          select: { id: true },
        });
        if (existing) continue;
        const assignment = await tx.studentFeeAssignment.create({
          data: {
            ...scope,
            studentProfileId: enrollment.studentProfileId,
            enrollmentId: enrollment.id,
            sectionId: section.id,
            feeStructureId: structure.id,
            structureLineId: line.id,
            installmentId: line.installmentId,
            feeHeadId: line.feeHeadId,
            source: FeeAssignmentSource.CLASS,
            description: `${structure.name} — ${line.feeHead.name}`,
            amountMinor: line.amountMinor,
            dueOn: line.installment.dueOn,
            createdBy: context.userId,
          },
        });
        await financialAudit(tx, context, scope, metadata, {
          studentProfileId: enrollment.studentProfileId,
          direction: FinancialDirection.DEBIT,
          amountMinor: line.amountMinor,
          action: "fee.assigned",
          resourceType: "StudentFeeAssignment",
          resourceId: assignment.id,
          metadata: { source: "CLASS", structureId: structure.id },
        });
        createdCount += 1;
      }
    }
    await audit(
      tx,
      context,
      metadata,
      "finance.structure.class_applied",
      "FeeStructure",
      structure.id,
      {
        sectionId: section.id,
        enrollmentCount: enrollments.length,
        createdCount,
      },
    );
    return {
      id: structure.id,
      feeStructureId: structure.id,
      sectionId: section.id,
      enrollmentCount: enrollments.length,
      createdCount,
    };
  }

  private async requestAdjustment(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: FeeScope,
    input: Extract<FeeMutation, { action: "adjustment.request" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "finance.adjustments.request", scope);
    const assignment = await tx.studentFeeAssignment.findFirstOrThrow({
      where: { ...scope, id: input.assignmentId, archivedAt: null },
    });
    const kind = input.kind as FeeAdjustmentKind;
    const result = await tx.feeAdjustment.create({
      data: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        assignmentId: assignment.id,
        kind,
        direction: adjustmentDirection(kind),
        amountMinor: parseInrToMinor(input.amount),
        reason: input.reason,
        requestedBy: context.userId,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "finance.adjustment.requested",
      "FeeAdjustment",
      result.id,
    );
    return result;
  }

  private async decideAdjustment(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: FeeScope,
    input: Extract<FeeMutation, { action: "adjustment.decide" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "finance.adjustments.approve", scope);
    const existing = await tx.feeAdjustment.findFirstOrThrow({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        id: input.adjustmentId,
        approvalState: FinanceApprovalState.PENDING,
      },
      include: { assignment: true },
    });
    if (existing.requestedBy === context.userId)
      throw new Error("A different user must approve a fee adjustment");
    const result = await tx.feeAdjustment.update({
      where: { id: existing.id },
      data: {
        approvalState: input.approve
          ? FinanceApprovalState.APPROVED
          : FinanceApprovalState.REJECTED,
        decidedBy: context.userId,
        decidedAt: new Date(),
        decisionNote: input.note,
      },
    });
    if (input.approve)
      await financialAudit(tx, context, scope, metadata, {
        studentProfileId: existing.assignment.studentProfileId,
        direction: existing.direction,
        amountMinor: existing.amountMinor,
        action: "fee.adjustment.approved",
        resourceType: "FeeAdjustment",
        resourceId: existing.id,
        metadata: { kind: existing.kind },
      });
    await audit(
      tx,
      context,
      metadata,
      input.approve
        ? "finance.adjustment.approved"
        : "finance.adjustment.rejected",
      "FeeAdjustment",
      result.id,
    );
    return result;
  }

  private async postPayment(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: FeeScope,
    input: Extract<FeeMutation, { action: "payment.post" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "finance.payments.collect", scope);
    const requestFingerprint = fingerprint(input);
    const existing = await tx.feePayment.findFirst({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        idempotencyKey: input.idempotencyKey,
      },
      include: { receipt: true, allocations: true },
    });
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint)
        throw new Error(
          "The idempotency key was already used for different payment data",
        );
      return existing;
    }
    const amountMinor = parseInrToMinor(input.amount);
    const allocations = input.allocations.map((item) => ({
      assignmentId: item.assignmentId,
      amountMinor: parseInrToMinor(item.amount),
    }));
    assertAllocationTotal(
      amountMinor,
      allocations.map((item) => item.amountMinor),
    );
    if (
      new Set(allocations.map((item) => item.assignmentId)).size !==
      allocations.length
    )
      throw new Error("Payment allocations contain duplicate fee assignments");
    const assignments = await tx.studentFeeAssignment.findMany({
      where: {
        ...scope,
        studentProfileId: input.studentProfileId,
        id: { in: allocations.map((item) => item.assignmentId) },
        archivedAt: null,
      },
      include: {
        adjustments: {
          where: { approvalState: FinanceApprovalState.APPROVED },
        },
        allocations: { include: { payment: { include: { reversal: true } } } },
      },
    });
    if (assignments.length !== allocations.length)
      throw new Error(
        "A payment allocation is outside the active tenant or student account",
      );
    for (const allocation of allocations) {
      const assignment = assignments.find(
        (item) => item.id === allocation.assignmentId,
      );
      if (!assignment) throw new Error("A payment allocation is invalid");
      const adjusted = assignment.adjustments.reduce(
        (total, item) =>
          total +
          (item.direction === FinancialDirection.DEBIT
            ? item.amountMinor
            : -item.amountMinor),
        assignment.amountMinor,
      );
      const paid = assignment.allocations
        .filter((item) => !item.payment.reversal)
        .reduce((total, item) => total + item.amountMinor, 0);
      if (allocation.amountMinor > adjusted - paid)
        throw new Error("A payment allocation exceeds the outstanding amount");
    }
    let provider: string | undefined;
    let providerPaymentId: string | undefined;
    let instrumentReference = input.instrumentReference;
    if (input.method === "CARD" || input.method === "ONLINE_GATEWAY") {
      const providerResult = await this.paymentProvider.createPayment({
        idempotencyKey: input.idempotencyKey,
        amountMinor,
        currency: "INR",
      });
      provider = providerResult.provider;
      providerPaymentId = providerResult.providerPaymentId;
      instrumentReference = providerResult.reference;
    }
    const payment = await tx.feePayment.create({
      data: {
        ...scope,
        studentProfileId: input.studentProfileId,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint,
        method: input.method as FeePaymentMethod,
        amountMinor,
        currency: "INR",
        instrumentReference,
        provider,
        providerPaymentId,
        paidAt: new Date(input.paidAt),
        postedBy: context.userId,
        allocations: {
          create: allocations.map((item) => ({
            trustId: scope.trustId,
            schoolId: scope.schoolId,
            assignmentId: item.assignmentId,
            amountMinor: item.amountMinor,
          })),
        },
      },
    });
    const sequence = await tx.feeReceiptSequence.upsert({
      where: {
        trustId_schoolId_academicYearId: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          academicYearId: scope.academicYearId,
        },
      },
      create: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        academicYearId: scope.academicYearId,
        currentValue: 1,
      },
      update: { currentValue: { increment: 1 } },
    });
    const year = await tx.academicYear.findFirstOrThrow({
      where: { trustId: scope.trustId, id: scope.academicYearId },
      select: { code: true },
    });
    const receiptNumber = `RCPT/${year.code}/${String(sequence.currentValue).padStart(6, "0")}`;
    const receipt = await tx.feeReceipt.create({
      data: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        paymentId: payment.id,
        receiptNumber,
        amountMinor,
        currency: "INR",
        snapshot: {
          receiptNumber,
          amountMinor,
          currency: "INR",
          method: input.method,
          paidAt: input.paidAt,
          allocations,
        },
        finalizedBy: context.userId,
      },
    });
    for (const allocation of allocations)
      await financialAudit(tx, context, scope, metadata, {
        studentProfileId: input.studentProfileId,
        direction: FinancialDirection.CREDIT,
        amountMinor: allocation.amountMinor,
        action: "payment.posted",
        resourceType: "FeePayment",
        resourceId: payment.id,
        metadata: { assignmentId: allocation.assignmentId, receiptNumber },
      });
    await audit(
      tx,
      context,
      metadata,
      "finance.payment.posted",
      "FeePayment",
      payment.id,
      { amountMinor, currency: "INR", method: input.method, receiptNumber },
    );
    return { ...payment, receipt };
  }

  private async reversePayment(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: FeeScope,
    input: Extract<FeeMutation, { action: "payment.reverse" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "finance.payments.collect", scope);
    const payment = await tx.feePayment.findFirstOrThrow({
      where: { ...scope, id: input.paymentId, state: FeePaymentState.POSTED },
      include: { allocations: true, reversal: true },
    });
    if (payment.reversal) throw new Error("The payment is already reversed");
    const reversal = await tx.feePaymentReversal.create({
      data: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        paymentId: payment.id,
        reason: input.reason,
        reversedBy: context.userId,
      },
    });
    await tx.feePayment.update({
      where: { id: payment.id },
      data: { state: FeePaymentState.REVERSED },
    });
    for (const allocation of payment.allocations)
      await financialAudit(tx, context, scope, metadata, {
        studentProfileId: payment.studentProfileId,
        direction: FinancialDirection.DEBIT,
        amountMinor: allocation.amountMinor,
        action: "payment.reversed",
        resourceType: "FeePaymentReversal",
        resourceId: reversal.id,
        metadata: {
          paymentId: payment.id,
          assignmentId: allocation.assignmentId,
        },
      });
    await audit(
      tx,
      context,
      metadata,
      "finance.payment.reversed",
      "FeePaymentReversal",
      reversal.id,
      { paymentId: payment.id, reason: input.reason },
    );
    return reversal;
  }

  private async requestRefund(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: FeeScope,
    input: Extract<FeeMutation, { action: "refund.request" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "finance.refunds.request", scope);
    const payment = await tx.feePayment.findFirstOrThrow({
      where: { ...scope, id: input.paymentId, state: FeePaymentState.POSTED },
      include: {
        refunds: {
          where: {
            state: { in: [FeeRefundState.PENDING, FeeRefundState.APPROVED] },
          },
        },
      },
    });
    const amountMinor = parseInrToMinor(input.amount);
    if (
      amountMinor + sumMinor(payment.refunds.map((item) => item.amountMinor)) >
      payment.amountMinor
    )
      throw new Error("Refunds cannot exceed the posted payment");
    const result = await tx.feeRefund.create({
      data: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        paymentId: payment.id,
        amountMinor,
        reason: input.reason,
        requestedBy: context.userId,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "finance.refund.requested",
      "FeeRefund",
      result.id,
    );
    return result;
  }

  private async decideRefund(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: FeeScope,
    input: Extract<FeeMutation, { action: "refund.decide" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "finance.refunds.approve", scope);
    const existing = await tx.feeRefund.findFirstOrThrow({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        id: input.refundId,
        state: FeeRefundState.PENDING,
      },
      include: { payment: true },
    });
    if (existing.requestedBy === context.userId)
      throw new Error("A different user must approve a refund");
    const result = await tx.feeRefund.update({
      where: { id: existing.id },
      data: {
        state: input.approve
          ? FeeRefundState.APPROVED
          : FeeRefundState.REJECTED,
        decidedBy: context.userId,
        decidedAt: new Date(),
        decisionNote: input.note,
        ...(input.approve ? { paidAt: new Date() } : {}),
      },
    });
    if (input.approve)
      await financialAudit(tx, context, scope, metadata, {
        studentProfileId: existing.payment.studentProfileId,
        direction: FinancialDirection.DEBIT,
        amountMinor: existing.amountMinor,
        action: "refund.approved",
        resourceType: "FeeRefund",
        resourceId: existing.id,
        metadata: { paymentId: existing.paymentId },
      });
    await audit(
      tx,
      context,
      metadata,
      input.approve ? "finance.refund.approved" : "finance.refund.rejected",
      "FeeRefund",
      result.id,
    );
    return result;
  }

  private async reconcile(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: FeeScope,
    input: Extract<FeeMutation, { action: "gateway.reconcile" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "finance.reconciliation.manage", scope);
    const payloadHash = fingerprint(input);
    const existing = await tx.paymentGatewayEvent.findFirst({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        provider: this.paymentProvider.provider,
        providerEventId: input.providerEventId,
      },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash)
        throw new Error(
          "The provider event identifier has conflicting payload data",
        );
      return existing;
    }
    const payment = await tx.feePayment.findFirst({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        provider: this.paymentProvider.provider,
        providerPaymentId: input.providerPaymentId,
      },
    });
    const result = await tx.paymentGatewayEvent.create({
      data: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        provider: this.paymentProvider.provider,
        providerEventId: input.providerEventId,
        providerPaymentId: input.providerPaymentId,
        eventType: input.eventType,
        payloadHash,
        state: payment
          ? GatewayEventState.RECONCILED
          : GatewayEventState.RECEIVED,
        reconciledAt: payment ? new Date() : undefined,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "finance.gateway.reconciled",
      "PaymentGatewayEvent",
      result.id,
      { matched: Boolean(payment) },
    );
    return result;
  }

  private async closeCollection(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: FeeScope,
    input: Extract<FeeMutation, { action: "collection.close" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "finance.collection.close", {
      ...scope,
      campusId: input.campusId,
    });
    const { startsAt, endsAt } = indiaDay(input.date);
    const payments = await tx.feePayment.findMany({
      where: {
        ...scope,
        campusId: input.campusId,
        paidAt: { gte: startsAt, lt: endsAt },
      },
      include: {
        reversal: true,
        refunds: { where: { state: FeeRefundState.APPROVED } },
      },
    });
    const grossMinor = sumMinor(payments.map((item) => item.amountMinor));
    const reversalMinor = sumMinor(
      payments.filter((item) => item.reversal).map((item) => item.amountMinor),
    );
    const refundMinor = sumMinor(
      payments.flatMap((item) =>
        item.refunds.map((refund) => refund.amountMinor),
      ),
    );
    const methodSummary = Object.values(FeePaymentMethod).map((method) => ({
      method,
      amountMinor: sumMinor(
        payments
          .filter((item) => item.method === method)
          .map((item) => item.amountMinor),
      ),
    }));
    const result = await tx.dailyCollectionClosure.create({
      data: {
        ...scope,
        campusId: input.campusId,
        collectionDate: dateOnly(input.date),
        grossAmountMinor: grossMinor,
        reversalMinor,
        refundMinor,
        netAmountMinor: grossMinor - reversalMinor - refundMinor,
        methodSummary,
        closedBy: context.userId,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "finance.collection.closed",
      "DailyCollectionClosure",
      result.id,
      { collectionDate: input.date, grossMinor, reversalMinor, refundMinor },
    );
    return result;
  }
}
