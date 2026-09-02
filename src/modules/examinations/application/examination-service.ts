import { createHash, randomUUID } from "node:crypto";

import {
  AuditOutcome,
  AuditSensitivity,
  GradebookState,
  ModerationStatus,
  RecordStatus,
  ReportGenerationState,
  StudentResultState,
  type Prisma,
  type PrismaClient,
} from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import type { RequestMetadata } from "@/modules/identity/domain/request-security";
import { authorize, requirePermission } from "@/server/authorization/authorize";
import { withTenant } from "@/server/database/tenant-context";

import {
  examinationMutationSchema,
  examinationWorkspaceQuerySchema,
  type ExaminationMutation,
} from "../domain/examination-contracts";
import {
  calculateResult,
  marksDoNotExceedMaximum,
  type CalculationEntry,
  type ResultRuleConfiguration,
} from "../domain/result-calculation";
import {
  LocalReportCardPdfAdapter,
  type ReportCardPdfAdapter,
} from "./report-card-adapter";

type ExaminationScope = {
  trustId: string;
  schoolId: string;
  campusId: string;
  academicYearId: string;
};

function activeScope(context: AuthenticatedContext): ExaminationScope {
  if (!context.schoolId || !context.campusId || !context.academicYearId)
    throw new Error("Select a school, campus, and academic year");
  return {
    trustId: context.trustId,
    schoolId: context.schoolId,
    campusId: context.campusId,
    academicYearId: context.academicYearId,
  };
}

function hasPermission(
  context: AuthenticatedContext,
  permission: string,
  scope: ExaminationScope,
) {
  return authorize(context, permission, scope).allowed;
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

function parseRules(value: Prisma.JsonValue): ResultRuleConfiguration {
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new Error("The examination rule configuration is invalid");
  const calculation = value.calculation;
  if (
    !calculation ||
    Array.isArray(calculation) ||
    typeof calculation !== "object"
  )
    throw new Error("The examination calculation rule is missing");
  const configured = calculation as Record<string, unknown>;
  if (
    !["EXCLUDE", "ZERO"].includes(String(configured.exemptHandling)) ||
    typeof configured.includeCoScholasticInPercentage !== "boolean" ||
    !["EQUAL_SUBJECTS", "TOTAL_MARKS"].includes(
      String(configured.subjectAggregation),
    ) ||
    typeof configured.requireComponentPass !== "boolean" ||
    ![2, 3, 4].includes(Number(configured.percentageScale))
  )
    throw new Error("The examination calculation rule is invalid");
  return {
    exemptHandling: configured.exemptHandling as "EXCLUDE" | "ZERO",
    includeCoScholasticInPercentage:
      configured.includeCoScholasticInPercentage as boolean,
    subjectAggregation: configured.subjectAggregation as
      "EQUAL_SUBJECTS" | "TOTAL_MARKS",
    requireComponentPass: configured.requireComponentPass as boolean,
    percentageScale: configured.percentageScale as 2 | 3 | 4,
  };
}

export class ExaminationService {
  constructor(
    private readonly client: PrismaClient,
    private readonly pdfAdapter: ReportCardPdfAdapter = new LocalReportCardPdfAdapter(),
  ) {}

  private async subjectAccess(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: ExaminationScope,
    examinationSubjectId: string,
    permission: string,
  ) {
    requirePermission(context, permission, scope);
    const subject = await tx.examinationSubject.findFirstOrThrow({
      where: {
        ...scope,
        id: examinationSubjectId,
        status: RecordStatus.ACTIVE,
      },
    });
    if (
      hasPermission(context, "assessments.assignments.override", scope) ||
      subject.assignedTeacherUserId === context.userId
    )
      return subject;
    const examination = await tx.examination.findFirstOrThrow({
      where: { ...scope, id: subject.examinationId },
      select: { startsOn: true, endsOn: true },
    });
    const assignment = await tx.attendanceTeachingAssignment.findFirst({
      where: {
        ...scope,
        sectionId: subject.sectionId,
        subjectId: subject.subjectId,
        teacherUserId: context.userId,
        status: RecordStatus.ACTIVE,
        effectiveFrom: { lte: examination.endsOn },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: examination.startsOn } },
        ],
      },
      select: { id: true },
    });
    if (!assignment)
      throw new Error("Teacher is not assigned to this subject and section");
    return subject;
  }

  async workspace(context: AuthenticatedContext, untrustedQuery: unknown) {
    const query = examinationWorkspaceQuerySchema.parse(untrustedQuery);
    const scope = activeScope(context);
    requirePermission(context, "assessments.workspace.read", scope);
    return withTenant(
      this.client,
      {
        trustId: scope.trustId,
        actorUserId: context.userId,
        correlationId: randomUUID(),
      },
      async (tx) => {
        const examinations = await tx.examination.findMany({
          where: { ...scope, archivedAt: null },
          orderBy: [{ startsOn: "desc" }, { name: "asc" }],
        });
        const examinationId = query.examinationId ?? examinations[0]?.id;
        const selectedExamination = examinations.find(
          (examination) => examination.id === examinationId,
        );
        let subjects = examinationId
          ? await tx.examinationSubject.findMany({
              where: { ...scope, examinationId, status: RecordStatus.ACTIVE },
              orderBy: { displayOrder: "asc" },
            })
          : [];
        if (
          !hasPermission(context, "assessments.assignments.override", scope)
        ) {
          const assignments = await tx.attendanceTeachingAssignment.findMany({
            where: {
              ...scope,
              teacherUserId: context.userId,
              status: RecordStatus.ACTIVE,
              ...(selectedExamination
                ? {
                    effectiveFrom: { lte: selectedExamination.endsOn },
                    OR: [
                      { effectiveTo: null },
                      { effectiveTo: { gte: selectedExamination.startsOn } },
                    ],
                  }
                : {}),
            },
            select: { sectionId: true, subjectId: true },
          });
          const allowed = new Set(
            assignments.map((item) => `${item.sectionId}:${item.subjectId}`),
          );
          subjects = subjects.filter(
            (subject) =>
              subject.assignedTeacherUserId === context.userId ||
              allowed.has(`${subject.sectionId}:${subject.subjectId}`),
          );
        }
        const selectedId = query.examinationSubjectId ?? subjects[0]?.id;
        const selected = subjects.find((subject) => subject.id === selectedId);
        if (query.examinationSubjectId && !selected)
          throw new Error(
            "Teacher is not assigned to this subject and section",
          );
        const [
          subjectCatalog,
          sectionCatalog,
          components,
          register,
          templates,
        ] = await Promise.all([
          tx.subject.findMany({
            where: {
              trustId: scope.trustId,
              schoolId: scope.schoolId,
              id: { in: subjects.map((item) => item.subjectId) },
            },
            select: { id: true, code: true, name: true },
          }),
          tx.section.findMany({
            where: {
              ...scope,
              id: { in: subjects.map((item) => item.sectionId) },
            },
            select: {
              id: true,
              name: true,
              gradeClass: { select: { name: true } },
            },
          }),
          selectedId
            ? tx.assessmentComponent.findMany({
                where: {
                  trustId: scope.trustId,
                  schoolId: scope.schoolId,
                  examinationSubjectId: selectedId,
                  status: RecordStatus.ACTIVE,
                },
                orderBy: { displayOrder: "asc" },
              })
            : Promise.resolve([]),
          selectedId
            ? tx.gradebookRegister.findFirst({
                where: {
                  ...scope,
                  examinationSubjectId: selectedId,
                },
              })
            : Promise.resolve(null),
          tx.reportCardTemplate.findMany({
            where: {
              trustId: scope.trustId,
              schoolId: scope.schoolId,
              status: RecordStatus.ACTIVE,
              OR: [
                { academicYearId: scope.academicYearId },
                { academicYearId: null },
              ],
            },
            orderBy: [{ version: "desc" }, { name: "asc" }],
          }),
        ]);
        const roster = selected
          ? await tx.studentEnrollment.findMany({
              where: {
                ...scope,
                sectionId: selected.sectionId,
                status: "ACTIVE",
              },
              select: {
                id: true,
                studentProfileId: true,
                rollNumber: true,
                studentProfile: {
                  select: {
                    studentNumber: true,
                    person: {
                      select: { firstName: true, lastName: true },
                    },
                  },
                },
              },
              orderBy: { rollNumber: "asc" },
            })
          : [];
        const entries = register
          ? await tx.markEntry.findMany({
              where: {
                trustId: scope.trustId,
                schoolId: scope.schoolId,
                registerId: register.id,
              },
            })
          : [];
        const results = examinationId
          ? await tx.studentResult.findMany({
              where: {
                ...scope,
                examinationId,
                studentProfileId: {
                  in: roster.map((item) => item.studentProfileId),
                },
              },
              orderBy: { calculatedAt: "desc" },
            })
          : [];
        const subjectById = new Map(
          subjectCatalog.map((item) => [item.id, item]),
        );
        const sectionById = new Map(
          sectionCatalog.map((item) => [item.id, item]),
        );
        return {
          scope,
          permissions: {
            canEnter: hasPermission(context, "assessments.marks.enter", scope),
            canApprove: hasPermission(
              context,
              "assessments.marks.approve",
              scope,
            ),
            canLock: hasPermission(context, "assessments.marks.lock", scope),
            canCalculate: hasPermission(
              context,
              "assessments.results.calculate",
              scope,
            ),
            canPublish: hasPermission(
              context,
              "assessments.results.publish",
              scope,
            ),
            canGenerate: hasPermission(
              context,
              "assessments.report.generate",
              scope,
            ),
          },
          examinations,
          subjects: subjects.map((item) => ({
            ...item,
            subject: subjectById.get(item.subjectId),
            section: sectionById.get(item.sectionId),
          })),
          selectedSubjectId: selectedId ?? null,
          components,
          register,
          roster,
          entries,
          results,
          templates,
        };
      },
    );
  }

  async mutate(
    context: AuthenticatedContext,
    untrustedInput: ExaminationMutation,
    metadata: RequestMetadata,
  ) {
    const input = examinationMutationSchema.parse(untrustedInput);
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
          case "marks.bulk.save":
            return this.saveMarks(tx, context, scope, input, metadata);
          case "register.approve":
            return this.transitionRegister(
              tx,
              context,
              scope,
              input.registerId,
              "APPROVED",
              metadata,
            );
          case "register.lock":
            return this.transitionRegister(
              tx,
              context,
              scope,
              input.registerId,
              "LOCKED",
              metadata,
            );
          case "register.reopen.request":
            return this.requestReopen(tx, context, scope, input, metadata);
          case "register.reopen.decide":
            return this.decideReopen(tx, context, scope, input, metadata);
          case "moderation.request":
            return this.requestModeration(tx, context, scope, input, metadata);
          case "moderation.decide":
            return this.decideModeration(tx, context, scope, input, metadata);
          case "results.calculate":
            return this.calculate(tx, context, scope, input, metadata);
          case "results.publish":
            return this.publish(tx, context, scope, input, metadata);
          case "report.preview":
            return this.report(tx, context, scope, input, metadata, true);
          case "report.generate":
            return this.report(tx, context, scope, input, metadata, false);
        }
      },
    );
  }

  private async saveMarks(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: ExaminationScope,
    input: Extract<ExaminationMutation, { action: "marks.bulk.save" }>,
    metadata: RequestMetadata,
  ) {
    const subject = await this.subjectAccess(
      tx,
      context,
      scope,
      input.examinationSubjectId,
      "assessments.marks.enter",
    );
    const register = await tx.gradebookRegister.findFirstOrThrow({
      where: { ...scope, examinationSubjectId: subject.id },
    });
    if (register.state === GradebookState.LOCKED)
      throw new Error("The marks register is locked");
    if (register.state === GradebookState.APPROVED)
      throw new Error(
        "Approved marks must be locked or reopened before editing",
      );
    const postLock = register.state === GradebookState.REOPENED;
    if (postLock && !input.reason)
      throw new Error("A reason is required for every post-lock change");
    const recordKeys = input.records.map(
      (item) => `${item.studentProfileId}:${item.componentId}`,
    );
    if (new Set(recordKeys).size !== recordKeys.length)
      throw new Error(
        "A marks submission contains duplicate learner components",
      );
    const components = await tx.assessmentComponent.findMany({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        examinationSubjectId: subject.id,
        id: { in: input.records.map((item) => item.componentId) },
        status: RecordStatus.ACTIVE,
      },
    });
    const componentById = new Map(components.map((item) => [item.id, item]));
    if (
      components.length !==
      new Set(input.records.map((item) => item.componentId)).size
    )
      throw new Error("A marks component is outside this examination subject");
    const roster = await tx.studentEnrollment.findMany({
      where: {
        ...scope,
        sectionId: subject.sectionId,
        id: { in: input.records.map((item) => item.enrollmentId) },
        status: "ACTIVE",
      },
      select: { id: true, studentProfileId: true },
    });
    const rosterKeys = new Set(
      roster.map((item) => `${item.id}:${item.studentProfileId}`),
    );
    if (
      input.records.some(
        (item) =>
          !rosterKeys.has(`${item.enrollmentId}:${item.studentProfileId}`),
      )
    )
      throw new Error("A learner is outside the examination section roster");
    let count = 0;
    for (const item of input.records) {
      const component = componentById.get(item.componentId)!;
      if (
        item.status === "MARKED" &&
        !marksDoNotExceedMaximum(item.marks, component.maximumMarks.toString())
      )
        throw new Error("Marks exceed the configured maximum");
      const existing = await tx.markEntry.findUnique({
        where: {
          trustId_schoolId_registerId_componentId_studentProfileId: {
            trustId: scope.trustId,
            schoolId: scope.schoolId,
            registerId: register.id,
            componentId: item.componentId,
            studentProfileId: item.studentProfileId,
          },
        },
      });
      const saved = await tx.markEntry.upsert({
        where: {
          trustId_schoolId_registerId_componentId_studentProfileId: {
            trustId: scope.trustId,
            schoolId: scope.schoolId,
            registerId: register.id,
            componentId: item.componentId,
            studentProfileId: item.studentProfileId,
          },
        },
        create: {
          ...scope,
          sectionId: subject.sectionId,
          registerId: register.id,
          examinationSubjectId: subject.id,
          componentId: item.componentId,
          enrollmentId: item.enrollmentId,
          studentProfileId: item.studentProfileId,
          status: item.status,
          marks: item.status === "MARKED" ? item.marks : null,
          teacherRemark: item.teacherRemark,
          enteredBy: context.userId,
          updatedBy: context.userId,
        },
        update: {
          status: item.status,
          marks: item.status === "MARKED" ? item.marks : null,
          teacherRemark: item.teacherRemark,
          updatedBy: context.userId,
        },
      });
      const changed =
        !existing ||
        existing.status !== item.status ||
        existing.marks?.toString() !==
          (item.status === "MARKED" ? item.marks : undefined) ||
        existing.teacherRemark !== item.teacherRemark;
      if (changed)
        await tx.markEntryChange.create({
          data: {
            trustId: scope.trustId,
            schoolId: scope.schoolId,
            markEntryId: saved.id,
            actorUserId: context.userId,
            fromStatus: existing?.status,
            toStatus: item.status,
            fromMarks: existing?.marks,
            toMarks: item.status === "MARKED" ? item.marks : null,
            reason:
              input.reason ??
              (existing ? "Marks entry updated" : "Initial marks entry"),
            postLockChange: postLock,
          },
        });
      count += 1;
    }
    if (postLock)
      await tx.studentResult.updateMany({
        where: {
          ...scope,
          examinationId: subject.examinationId,
          studentProfileId: {
            in: [
              ...new Set(input.records.map((item) => item.studentProfileId)),
            ],
          },
          state: StudentResultState.PUBLISHED,
        },
        data: { state: StudentResultState.SUPERSEDED },
      });
    await audit(
      tx,
      context,
      metadata,
      postLock
        ? "assessments.marks.post_lock_changed"
        : "assessments.marks.saved",
      "GradebookRegister",
      register.id,
      { recordCount: count, examinationSubjectId: subject.id },
    );
    return { registerId: register.id, recordCount: count };
  }

  private async transitionRegister(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: ExaminationScope,
    registerId: string,
    target: "APPROVED" | "LOCKED",
    metadata: RequestMetadata,
  ) {
    requirePermission(
      context,
      target === "APPROVED"
        ? "assessments.marks.approve"
        : "assessments.marks.lock",
      scope,
    );
    const register = await tx.gradebookRegister.findFirstOrThrow({
      where: { ...scope, id: registerId },
    });
    if (
      (target === "APPROVED" &&
        register.state !== GradebookState.ENTRY &&
        register.state !== GradebookState.REOPENED) ||
      (target === "LOCKED" && register.state !== GradebookState.APPROVED)
    )
      throw new Error(`The marks register cannot transition to ${target}`);
    if (target === "APPROVED") {
      const subject = await tx.examinationSubject.findFirstOrThrow({
        where: {
          ...scope,
          id: register.examinationSubjectId,
          status: RecordStatus.ACTIVE,
        },
      });
      const [componentCount, rosterCount, entryCount] = await Promise.all([
        tx.assessmentComponent.count({
          where: {
            trustId: scope.trustId,
            schoolId: scope.schoolId,
            examinationSubjectId: subject.id,
            status: RecordStatus.ACTIVE,
          },
        }),
        tx.studentEnrollment.count({
          where: {
            ...scope,
            sectionId: subject.sectionId,
            status: "ACTIVE",
          },
        }),
        tx.markEntry.count({
          where: { ...scope, registerId: register.id },
        }),
      ]);
      if (
        componentCount === 0 ||
        rosterCount === 0 ||
        entryCount !== componentCount * rosterCount
      )
        throw new Error(
          "Every learner component must be entered before approval",
        );
    }
    const updated = await tx.gradebookRegister.update({
      where: { id: register.id },
      data:
        target === "APPROVED"
          ? {
              state: GradebookState.APPROVED,
              approvedBy: context.userId,
              approvedAt: new Date(),
              version: { increment: 1 },
            }
          : {
              state: GradebookState.LOCKED,
              lockedBy: context.userId,
              lockedAt: new Date(),
              version: { increment: 1 },
            },
    });
    await audit(
      tx,
      context,
      metadata,
      target === "APPROVED"
        ? "assessments.register.approved"
        : "assessments.register.locked",
      "GradebookRegister",
      register.id,
      { from: register.state, to: target },
    );
    return updated;
  }

  private async requestReopen(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: ExaminationScope,
    input: Extract<ExaminationMutation, { action: "register.reopen.request" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "assessments.marks.reopen.request", scope);
    const register = await tx.gradebookRegister.findFirstOrThrow({
      where: { ...scope, id: input.registerId },
    });
    if (register.state !== GradebookState.LOCKED)
      throw new Error("Only a locked marks register can be reopened");
    const request = await tx.gradebookReopenRequest.create({
      data: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        registerId: register.id,
        requestedBy: context.userId,
        reason: input.reason,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "assessments.register.reopen_requested",
      "GradebookReopenRequest",
      request.id,
      { registerId: register.id },
    );
    return request;
  }

  private async decideReopen(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: ExaminationScope,
    input: Extract<ExaminationMutation, { action: "register.reopen.decide" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "assessments.marks.reopen.approve", scope);
    const request = await tx.gradebookReopenRequest.findFirstOrThrow({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        id: input.requestId,
        status: ModerationStatus.PENDING,
      },
    });
    if (request.requestedBy === context.userId)
      throw new Error("A different user must approve reopening");
    const status = input.approve
      ? ModerationStatus.APPROVED
      : ModerationStatus.REJECTED;
    await tx.gradebookReopenRequest.update({
      where: { id: request.id },
      data: {
        status,
        decidedBy: context.userId,
        decidedAt: new Date(),
        decisionNote: input.note,
      },
    });
    if (input.approve)
      await tx.gradebookRegister.update({
        where: { id: request.registerId },
        data: {
          state: GradebookState.REOPENED,
          reopenedAt: new Date(),
          version: { increment: 1 },
        },
      });
    await audit(
      tx,
      context,
      metadata,
      "assessments.register.reopen_decided",
      "GradebookReopenRequest",
      request.id,
      { decision: status },
    );
    return { id: request.id, status };
  }

  private async requestModeration(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: ExaminationScope,
    input: Extract<ExaminationMutation, { action: "moderation.request" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "assessments.marks.moderate", scope);
    const entry = await tx.markEntry.findFirstOrThrow({
      where: { ...scope, id: input.markEntryId },
    });
    const register = await tx.gradebookRegister.findUniqueOrThrow({
      where: { id: entry.registerId },
    });
    if (register.state === GradebookState.LOCKED)
      throw new Error("Reopen the locked register before moderation");
    const component = await tx.assessmentComponent.findUniqueOrThrow({
      where: { id: entry.componentId },
    });
    if (
      input.proposed.status === "MARKED" &&
      !marksDoNotExceedMaximum(
        input.proposed.marks,
        component.maximumMarks.toString(),
      )
    )
      throw new Error("Marks exceed the configured maximum");
    const request = await tx.markModerationRequest.create({
      data: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        markEntryId: entry.id,
        requestedBy: context.userId,
        proposedStatus: input.proposed.status,
        proposedMarks:
          input.proposed.status === "MARKED" ? input.proposed.marks : null,
        reason: input.reason,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "assessments.moderation.requested",
      "MarkModerationRequest",
      request.id,
      { markEntryId: entry.id },
    );
    return request;
  }

  private async decideModeration(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: ExaminationScope,
    input: Extract<ExaminationMutation, { action: "moderation.decide" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "assessments.marks.approve", scope);
    const request = await tx.markModerationRequest.findFirstOrThrow({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        id: input.requestId,
        status: ModerationStatus.PENDING,
      },
    });
    if (request.requestedBy === context.userId)
      throw new Error("A different user must approve moderation");
    const status = input.approve
      ? ModerationStatus.APPROVED
      : ModerationStatus.REJECTED;
    await tx.markModerationRequest.update({
      where: { id: request.id },
      data: {
        status,
        decidedBy: context.userId,
        decidedAt: new Date(),
        decisionNote: input.note,
      },
    });
    if (input.approve) {
      const entry = await tx.markEntry.findUniqueOrThrow({
        where: { id: request.markEntryId },
      });
      const register = await tx.gradebookRegister.findUniqueOrThrow({
        where: { id: entry.registerId },
      });
      if (register.state === GradebookState.LOCKED)
        throw new Error("Reopen the locked register before moderation");
      await tx.markEntry.update({
        where: { id: entry.id },
        data: {
          status: request.proposedStatus,
          marks: request.proposedMarks,
          updatedBy: context.userId,
        },
      });
      await tx.markEntryChange.create({
        data: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          markEntryId: entry.id,
          actorUserId: context.userId,
          fromStatus: entry.status,
          toStatus: request.proposedStatus,
          fromMarks: entry.marks,
          toMarks: request.proposedMarks,
          reason: request.reason,
          postLockChange: register.state === GradebookState.REOPENED,
        },
      });
    }
    await audit(
      tx,
      context,
      metadata,
      "assessments.moderation.decided",
      "MarkModerationRequest",
      request.id,
      { decision: status },
    );
    return { id: request.id, status };
  }

  private async calculate(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: ExaminationScope,
    input: Extract<ExaminationMutation, { action: "results.calculate" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "assessments.results.calculate", scope);
    const examination = await tx.examination.findFirstOrThrow({
      where: { ...scope, id: input.examinationId },
    });
    const offerings = await tx.examinationSubject.findMany({
      where: {
        ...scope,
        examinationId: examination.id,
        status: RecordStatus.ACTIVE,
      },
    });
    if (!offerings.length) throw new Error("The examination has no subjects");
    const registers = await tx.gradebookRegister.findMany({
      where: {
        ...scope,
        examinationSubjectId: { in: offerings.map((item) => item.id) },
      },
    });
    if (
      registers.length !== offerings.length ||
      registers.some((register) => register.state !== GradebookState.LOCKED)
    )
      throw new Error("All marks registers must be locked before calculation");
    const enrollment = await tx.studentEnrollment.findFirstOrThrow({
      where: {
        ...scope,
        studentProfileId: input.studentProfileId,
        sectionId: { in: offerings.map((item) => item.sectionId) },
        status: "ACTIVE",
      },
    });
    const [components, marks, subjects, ruleSet] = await Promise.all([
      tx.assessmentComponent.findMany({
        where: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          examinationSubjectId: { in: offerings.map((item) => item.id) },
          status: RecordStatus.ACTIVE,
        },
      }),
      tx.markEntry.findMany({
        where: {
          ...scope,
          examinationSubjectId: { in: offerings.map((item) => item.id) },
          studentProfileId: input.studentProfileId,
        },
      }),
      tx.subject.findMany({
        where: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          id: { in: offerings.map((item) => item.subjectId) },
        },
      }),
      tx.examinationRuleSet.findFirstOrThrow({
        where: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          id: examination.ruleSetId,
          status: RecordStatus.ACTIVE,
        },
      }),
    ]);
    if (marks.length !== components.length)
      throw new Error(
        "Every component requires a mark, absent, or exempt status",
      );
    const subjectByOffering = new Map(
      offerings.map((offering) => [
        offering.id,
        subjects.find((subject) => subject.id === offering.subjectId)!,
      ]),
    );
    const markByComponent = new Map(
      marks.map((mark) => [mark.componentId, mark]),
    );
    const calculationEntries: CalculationEntry[] = components.map(
      (component) => {
        const mark = markByComponent.get(component.id);
        const subject = subjectByOffering.get(component.examinationSubjectId);
        if (!mark || !subject)
          throw new Error("The gradebook configuration is incomplete");
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          componentId: component.id,
          componentName: component.name,
          maximumMarks: component.maximumMarks.toString(),
          passingMarks: component.passingMarks?.toString(),
          weightagePercent: component.weightagePercent.toString(),
          coScholastic: component.isCoScholastic,
          status: mark.status,
          marks: mark.marks?.toString(),
        };
      },
    );
    const gradeBands = await tx.gradeBand.findMany({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        gradingScaleId: ruleSet.gradingScaleId,
        status: RecordStatus.ACTIVE,
      },
      orderBy: { sequence: "asc" },
    });
    const result = calculateResult(
      calculationEntries,
      parseRules(ruleSet.rules),
      gradeBands.map((band) => ({
        code: band.code,
        name: band.name,
        minimumValue: band.minimumValue.toString(),
        maximumValue: band.maximumValue.toString(),
      })),
    );
    const attendance = await tx.studentAttendanceRecord.findMany({
      where: {
        ...scope,
        studentProfileId: input.studentProfileId,
      },
      select: {
        statusDefinition: { select: { presentFraction: true } },
      },
    });
    const attendanceSummary = {
      markedDays: attendance.length,
      presentEquivalent:
        attendance.reduce(
          (total, item) => total + item.statusDefinition.presentFraction,
          0,
        ) / 100,
    };
    const calculationSnapshot = {
      ruleSet: { id: ruleSet.id, code: ruleSet.code, version: ruleSet.version },
      ...result,
    } as Prisma.InputJsonValue;
    const saved = await tx.studentResult.upsert({
      where: {
        trustId_schoolId_examinationId_studentProfileId: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          examinationId: examination.id,
          studentProfileId: input.studentProfileId,
        },
      },
      create: {
        ...scope,
        sectionId: enrollment.sectionId,
        examinationId: examination.id,
        enrollmentId: enrollment.id,
        studentProfileId: input.studentProfileId,
        totalMaximumMarks: result.totalMaximumMarks,
        totalObtainedMarks: result.totalObtainedMarks,
        percentage: result.percentage,
        gradeCode: result.gradeCode,
        passed: result.passed,
        teacherRemark: input.teacherRemark,
        principalRemark: input.principalRemark,
        promotionRecommendation: input.promotionRecommendation,
        attendanceSummary,
        calculationSnapshot,
        calculatedBy: context.userId,
      },
      update: {
        state: StudentResultState.CALCULATED,
        version: { increment: 1 },
        totalMaximumMarks: result.totalMaximumMarks,
        totalObtainedMarks: result.totalObtainedMarks,
        percentage: result.percentage,
        gradeCode: result.gradeCode,
        passed: result.passed,
        teacherRemark: input.teacherRemark,
        principalRemark: input.principalRemark,
        promotionRecommendation: input.promotionRecommendation,
        attendanceSummary,
        calculationSnapshot,
        calculatedBy: context.userId,
        calculatedAt: new Date(),
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "assessments.result.calculated",
      "StudentResult",
      saved.id,
      { examinationId: examination.id, version: saved.version },
    );
    return saved;
  }

  private async publish(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: ExaminationScope,
    input: Extract<ExaminationMutation, { action: "results.publish" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "assessments.results.publish", scope);
    const examination = await tx.examination.findFirstOrThrow({
      where: { ...scope, id: input.examinationId },
    });
    const results = await tx.studentResult.findMany({
      where: {
        ...scope,
        examinationId: examination.id,
        state: StudentResultState.CALCULATED,
        ...(input.studentProfileIds
          ? { studentProfileId: { in: input.studentProfileIds } }
          : {}),
      },
    });
    if (!results.length)
      throw new Error("No calculated results are available to publish");
    const publicationIds: string[] = [];
    for (const result of results) {
      const version =
        (await tx.resultPublication.count({
          where: {
            trustId: scope.trustId,
            schoolId: scope.schoolId,
            studentResultId: result.id,
          },
        })) + 1;
      const snapshot = {
        schemaVersion: 1,
        examination: {
          id: examination.id,
          code: examination.code,
          name: examination.name,
        },
        result: {
          id: result.id,
          version: result.version,
          studentProfileId: result.studentProfileId,
          totalMaximumMarks: result.totalMaximumMarks.toString(),
          totalObtainedMarks: result.totalObtainedMarks.toString(),
          percentage: result.percentage.toString(),
          gradeCode: result.gradeCode,
          passed: result.passed,
          teacherRemark: result.teacherRemark,
          principalRemark: result.principalRemark,
          promotionRecommendation: result.promotionRecommendation,
          attendanceSummary: result.attendanceSummary,
          calculation: result.calculationSnapshot,
        },
      } as Prisma.InputJsonValue;
      const serialized = JSON.stringify(snapshot);
      const publication = await tx.resultPublication.create({
        data: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          examinationId: examination.id,
          studentResultId: result.id,
          studentProfileId: result.studentProfileId,
          version,
          snapshot,
          snapshotHash: createHash("sha256").update(serialized).digest("hex"),
          publishedBy: context.userId,
        },
      });
      publicationIds.push(publication.id);
      await tx.studentResult.update({
        where: { id: result.id },
        data: { state: StudentResultState.PUBLISHED },
      });
    }
    await tx.examination.update({
      where: { id: examination.id },
      data: {
        state: "PUBLISHED",
        publishedAt: new Date(),
        publishedBy: context.userId,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "assessments.results.published",
      "Examination",
      examination.id,
      { resultCount: publicationIds.length },
    );
    return { examinationId: examination.id, publicationIds };
  }

  private async report(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: ExaminationScope,
    input: Extract<
      ExaminationMutation,
      { action: "report.preview" | "report.generate" }
    >,
    metadata: RequestMetadata,
    preview: boolean,
  ) {
    requirePermission(context, "assessments.report.generate", scope);
    const [examination, template] = await Promise.all([
      tx.examination.findFirstOrThrow({
        where: { ...scope, id: input.examinationId },
      }),
      tx.reportCardTemplate.findFirstOrThrow({
        where: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          id: input.templateId,
          status: RecordStatus.ACTIVE,
        },
      }),
    ]);
    const studentProfileId =
      "studentProfileId" in input ? input.studentProfileId : undefined;
    const results = await tx.studentResult.findMany({
      where: {
        ...scope,
        examinationId: examination.id,
        ...(studentProfileId ? { studentProfileId } : {}),
        ...(preview ? {} : { state: StudentResultState.PUBLISHED }),
      },
      orderBy: { studentProfileId: "asc" },
    });
    if (!results.length)
      throw new Error(
        preview
          ? "No calculated result is available for preview"
          : "Only published results can be generated",
      );
    if (!preview) {
      const publications = await tx.resultPublication.count({
        where: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          examinationId: examination.id,
          studentProfileId: {
            in: results.map((item) => item.studentProfileId),
          },
        },
      });
      if (publications < results.length)
        throw new Error("Only published results can be generated");
    }
    const people = await tx.studentProfile.findMany({
      where: {
        trustId: scope.trustId,
        id: { in: results.map((item) => item.studentProfileId) },
      },
      select: {
        id: true,
        studentNumber: true,
        person: { select: { firstName: true, lastName: true } },
      },
    });
    const personById = new Map(people.map((person) => [person.id, person]));
    const snapshot = {
      schemaVersion: 1,
      preview,
      schoolId: scope.schoolId,
      examination: {
        id: examination.id,
        code: examination.code,
        name: examination.name,
      },
      template: {
        id: template.id,
        code: template.code,
        version: template.version,
        configuration: template.configuration,
        branding: template.branding,
      },
      reports: results.map((result) => ({
        student: personById.get(result.studentProfileId),
        percentage: result.percentage.toString(),
        gradeCode: result.gradeCode,
        passed: result.passed,
        promotionRecommendation: result.promotionRecommendation,
        teacherRemark: result.teacherRemark,
        principalRemark: result.principalRemark,
        attendanceSummary: result.attendanceSummary,
        calculation: result.calculationSnapshot,
      })),
      qrVerification: { kind: "PLACEHOLDER", value: null },
    } as Prisma.InputJsonValue;
    const verificationCode = randomUUID();
    const generation = await tx.reportCardGeneration.create({
      data: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        examinationId: examination.id,
        templateId: template.id,
        studentProfileId,
        kind:
          preview || input.action === "report.preview" ? "PREVIEW" : input.kind,
        state: ReportGenerationState.QUEUED,
        snapshot,
        verificationCode,
        requestedBy: context.userId,
      },
    });
    if (!preview)
      await this.pdfAdapter.queue({
        generationId: generation.id,
        verificationCode,
        snapshot: snapshot as Prisma.JsonObject,
      });
    await audit(
      tx,
      context,
      metadata,
      preview ? "assessments.report.previewed" : "assessments.report.queued",
      "ReportCardGeneration",
      generation.id,
      { reportCount: results.length, kind: generation.kind },
    );
    return generation;
  }
}
