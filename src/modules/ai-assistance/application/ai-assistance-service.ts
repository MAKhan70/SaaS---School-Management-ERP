import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import type { RequestMetadata } from "@/modules/identity/domain/request-security";
import {
  aiAssistanceMutationSchema,
  assertDraftIsAdvisory,
  type AiAssistanceMutation,
  type SupportFactor,
} from "@/modules/ai-assistance/domain/ai-contracts";
import {
  deterministicFallback,
  LocalMockAiProvider,
  type AiDraftProvider,
} from "@/modules/ai-assistance/application/ai-provider";
import {
  attendanceReviewRule,
  identifyAttendanceReviewCandidates,
} from "@/modules/ai-assistance/domain/support-indicator-policy";
import { authorize, requirePermission } from "@/server/authorization/authorize";
import { withTenant } from "@/server/database/tenant-context";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableSnapshot(value: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
}

function maskedStudentReference(studentNumber: string): string {
  return `Student ••••${studentNumber.slice(-4).padStart(4, "•")}`;
}

function factors(value: Prisma.JsonValue): SupportFactor[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      typeof item.key !== "string" ||
      typeof item.label !== "string" ||
      typeof item.value !== "number" ||
      typeof item.explanation !== "string"
    )
      return [];
    return [
      {
        key: item.key,
        label: item.label,
        value: item.value,
        explanation: item.explanation,
      },
    ];
  });
}

export class AiAssistanceService {
  constructor(
    private readonly database: PrismaClient,
    private readonly provider: AiDraftProvider = new LocalMockAiProvider(),
  ) {}

  async workspace(context: AuthenticatedContext) {
    const canReadDrafts = authorize(context, "ai.assistance.review", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      campusId: context.campusId,
    }).allowed;
    const canReadIndicators = authorize(context, "analytics.support.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      campusId: context.campusId,
    }).allowed;
    const canReadAudit = authorize(context, "ai.audit.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      campusId: context.campusId,
    }).allowed;
    if (!canReadDrafts && !canReadIndicators && !canReadAudit)
      requirePermission(context, "ai.assistance.draft", {
        trustId: context.trustId,
        schoolId: context.schoolId,
        campusId: context.campusId,
      });

    return withTenant(
      this.database,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: crypto.randomUUID(),
      },
      async (transaction) => {
        const [drafts, indicators, auditEvents] = await Promise.all([
          canReadDrafts
            ? transaction.aiAssistanceRecord.findMany({
                where: {
                  trustId: context.trustId,
                  schoolId: context.schoolId,
                  ...(context.campusId
                    ? {
                        OR: [
                          { campusId: null },
                          { campusId: context.campusId },
                        ],
                      }
                    : {}),
                },
                orderBy: { createdAt: "desc" },
                take: 30,
              })
            : [],
          canReadIndicators
            ? transaction.studentSupportIndicator.findMany({
                where: {
                  trustId: context.trustId,
                  schoolId: context.schoolId,
                  academicYearId: context.academicYearId,
                  ...(context.campusId ? { campusId: context.campusId } : {}),
                },
                select: {
                  id: true,
                  ruleKey: true,
                  ruleVersion: true,
                  observedOn: true,
                  reasonSummary: true,
                  factors: true,
                  status: true,
                  reviewerNote: true,
                  reviewedAt: true,
                  studentProfile: { select: { studentNumber: true } },
                },
                orderBy: { observedOn: "desc" },
                take: 50,
              })
            : [],
          canReadAudit
            ? transaction.aiAssistanceAuditEvent.findMany({
                where: {
                  trustId: context.trustId,
                  schoolId: context.schoolId,
                },
                select: {
                  id: true,
                  assistanceRecordId: true,
                  action: true,
                  providerVersion: true,
                  reviewerAction: true,
                  occurredAt: true,
                },
                orderBy: { occurredAt: "desc" },
                take: 50,
              })
            : [],
        ]);
        return {
          policy: {
            draftOnly: true,
            provider: this.provider.kind,
            providerVersion: this.provider.version,
            externalProviderEnabled: false,
            prohibitedAutonomousDecisions: [
              "admission",
              "discipline",
              "scholarship",
              "promotion",
              "finance",
            ],
          },
          permissions: {
            canCreateDraft: authorize(context, "ai.assistance.draft", {
              trustId: context.trustId,
              schoolId: context.schoolId,
              campusId: context.campusId,
            }).allowed,
            canReviewDraft: canReadDrafts,
            canReadIndicators,
            canReviewIndicators: authorize(
              context,
              "analytics.support.review",
              {
                trustId: context.trustId,
                schoolId: context.schoolId,
                campusId: context.campusId,
              },
            ).allowed,
            canReadAudit,
          },
          drafts: drafts.map((draft) => ({
            id: draft.id,
            feature: draft.feature,
            provider: draft.provider,
            providerVersion: draft.providerVersion,
            draftOutput: draft.draftOutput,
            fallbackOutput: draft.fallbackOutput,
            finalOutput: draft.finalOutput,
            status: draft.status,
            reviewerNote: draft.reviewerNote,
            createdAt: draft.createdAt.toISOString(),
            reviewedAt: draft.reviewedAt?.toISOString(),
          })),
          indicators: indicators.map((indicator) => ({
            id: indicator.id,
            studentReference: maskedStudentReference(
              indicator.studentProfile.studentNumber,
            ),
            ruleKey: indicator.ruleKey,
            ruleVersion: indicator.ruleVersion,
            observedOn: indicator.observedOn.toISOString().slice(0, 10),
            reasonSummary: indicator.reasonSummary,
            factors: factors(indicator.factors),
            status: indicator.status,
            reviewerNote: indicator.reviewerNote,
            reviewedAt: indicator.reviewedAt?.toISOString(),
          })),
          auditEvents: auditEvents.map((event) => ({
            id: event.id,
            assistanceRecordId: event.assistanceRecordId,
            action: event.action,
            providerVersion: event.providerVersion,
            reviewerAction: event.reviewerAction,
            occurredAt: event.occurredAt.toISOString(),
          })),
        };
      },
    );
  }

  async mutate(
    context: AuthenticatedContext,
    rawInput: AiAssistanceMutation,
    metadata: RequestMetadata,
    now = new Date(),
  ) {
    const input = aiAssistanceMutationSchema.parse(rawInput);
    if (input.action === "CREATE_DRAFT")
      return this.createDraft(context, input, metadata, now);
    if (input.action === "REVIEW_DRAFT")
      return this.reviewDraft(context, input, metadata, now);
    if (input.action === "REFRESH_INDICATORS")
      return this.refreshIndicators(context, input, metadata, now);
    return this.reviewIndicator(context, input, metadata, now);
  }

  private async createDraft(
    context: AuthenticatedContext,
    input: Extract<AiAssistanceMutation, { action: "CREATE_DRAFT" }>,
    metadata: RequestMetadata,
    now: Date,
  ) {
    const schoolId = input.schoolId ?? context.schoolId;
    const campusId = input.campusId ?? context.campusId;
    const academicYearId = input.academicYearId ?? context.academicYearId;
    requirePermission(context, "ai.assistance.draft", {
      trustId: context.trustId,
      schoolId,
      campusId,
    });
    if (
      this.provider.kind === "EXTERNAL" &&
      process.env.NODE_ENV !== "production"
    )
      throw new Error("External AI providers are disabled outside production");

    const snapshot = { feature: input.feature, context: input.context };
    const serialized = stableSnapshot(snapshot);
    const inputHash = hash(serialized);
    const fallbackOutput = deterministicFallback(input.feature, input.context);
    const draftOutput = await this.provider.generate(
      input.feature,
      input.context,
    );
    assertDraftIsAdvisory(draftOutput);

    return withTenant(
      this.database,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: metadata.correlationId,
      },
      async (transaction) => {
        const [school, campus, year] = await Promise.all([
          transaction.school.findFirst({
            where: { trustId: context.trustId, id: schoolId },
          }),
          campusId
            ? transaction.campus.findFirst({
                where: { trustId: context.trustId, schoolId, id: campusId },
              })
            : null,
          transaction.academicYear.findFirst({
            where: { trustId: context.trustId, schoolId, id: academicYearId },
          }),
        ]);
        if (!school || (campusId && !campus) || !year)
          throw new Error("Assistance scope is invalid");
        const record = await transaction.aiAssistanceRecord.create({
          data: {
            trustId: context.trustId,
            schoolId,
            campusId,
            academicYearId,
            feature: input.feature,
            provider: this.provider.kind,
            providerVersion: this.provider.version,
            inputSnapshot: snapshot,
            inputHash,
            draftOutput,
            fallbackOutput,
            createdBy: context.userId,
            createdAt: now,
          },
        });
        await Promise.all([
          transaction.aiAssistanceAuditEvent.create({
            data: {
              trustId: context.trustId,
              schoolId,
              assistanceRecordId: record.id,
              action: "DRAFT_CREATED",
              providerVersion: this.provider.version,
              inputHash,
              outputHash: hash(draftOutput),
              actorUserId: context.userId,
              occurredAt: now,
            },
          }),
          transaction.auditEvent.create({
            data: {
              trustId: context.trustId,
              schoolId,
              campusId,
              actorUserId: context.userId,
              action: "ai_assistance.draft_created",
              resourceType: "AiAssistanceRecord",
              resourceId: record.id,
              outcome: "SUCCEEDED",
              sensitivity: "SENSITIVE",
              correlationId: metadata.correlationId,
              metadata: {
                feature: input.feature,
                providerVersion: this.provider.version,
              },
            },
          }),
        ]);
        return {
          id: record.id,
          status: record.status,
          draftOutput,
          fallbackOutput,
        };
      },
    );
  }

  private async reviewDraft(
    context: AuthenticatedContext,
    input: Extract<AiAssistanceMutation, { action: "REVIEW_DRAFT" }>,
    metadata: RequestMetadata,
    now: Date,
  ) {
    requirePermission(context, "ai.assistance.review", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      campusId: context.campusId,
    });
    const status =
      input.decision === "ACCEPT"
        ? "ACCEPTED"
        : input.decision === "EDIT"
          ? "EDITED"
          : "DISMISSED";
    return withTenant(
      this.database,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: metadata.correlationId,
      },
      async (transaction) => {
        const draft = await transaction.aiAssistanceRecord.findFirst({
          where: {
            trustId: context.trustId,
            schoolId: context.schoolId,
            id: input.draftId,
          },
        });
        if (!draft) throw new Error("Assistance draft was not found");
        if (draft.status !== "DRAFT")
          throw new Error("Assistance draft was already reviewed");
        const finalOutput =
          input.decision === "DISMISS"
            ? null
            : (input.finalOutput ?? draft.draftOutput);
        if (finalOutput) assertDraftIsAdvisory(finalOutput);
        const result = await transaction.aiAssistanceRecord.update({
          where: { id: draft.id },
          data: {
            status,
            finalOutput,
            reviewerNote: input.reviewerNote,
            reviewedBy: context.userId,
            reviewedAt: now,
          },
        });
        await Promise.all([
          transaction.aiAssistanceAuditEvent.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              assistanceRecordId: draft.id,
              action: "DRAFT_REVIEWED",
              providerVersion: draft.providerVersion,
              inputHash: draft.inputHash,
              outputHash: hash(finalOutput ?? draft.draftOutput),
              reviewerAction: input.decision,
              actorUserId: context.userId,
              occurredAt: now,
            },
          }),
          transaction.auditEvent.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              campusId: draft.campusId,
              actorUserId: context.userId,
              action: "ai_assistance.draft_reviewed",
              resourceType: "AiAssistanceRecord",
              resourceId: draft.id,
              outcome: "SUCCEEDED",
              sensitivity: "SENSITIVE",
              correlationId: metadata.correlationId,
              reasonCode: input.decision,
            },
          }),
        ]);
        return { id: result.id, status: result.status };
      },
    );
  }

  private async refreshIndicators(
    context: AuthenticatedContext,
    input: Extract<AiAssistanceMutation, { action: "REFRESH_INDICATORS" }>,
    metadata: RequestMetadata,
    now: Date,
  ) {
    const schoolId = input.schoolId ?? context.schoolId;
    const campusId = input.campusId ?? context.campusId;
    const academicYearId = input.academicYearId ?? context.academicYearId;
    requirePermission(context, "analytics.support.review", {
      trustId: context.trustId,
      schoolId,
      campusId,
    });
    if (!campusId)
      throw new Error("A campus must be selected to refresh indicators");
    const observedOn = new Date(
      `${now.toISOString().slice(0, 10)}T00:00:00.000Z`,
    );
    return withTenant(
      this.database,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: metadata.correlationId,
      },
      async (transaction) => {
        const records = await transaction.studentAttendanceRecord.findMany({
          where: {
            trustId: context.trustId,
            schoolId,
            campusId,
            academicYearId,
          },
          select: {
            studentProfileId: true,
            campusId: true,
            statusDefinition: { select: { presentFraction: true } },
          },
        });
        const observations = new Map<
          string,
          {
            studentProfileId: string;
            campusId: string;
            totalRecords: number;
            presentFractionTotal: number;
          }
        >();
        for (const record of records) {
          const item = observations.get(record.studentProfileId) ?? {
            studentProfileId: record.studentProfileId,
            campusId: record.campusId,
            totalRecords: 0,
            presentFractionTotal: 0,
          };
          item.totalRecords += 1;
          item.presentFractionTotal += record.statusDefinition.presentFraction;
          observations.set(record.studentProfileId, item);
        }
        const candidates = identifyAttendanceReviewCandidates([
          ...observations.values(),
        ]);
        let created = 0;
        for (const candidate of candidates) {
          const existing = await transaction.studentSupportIndicator.findFirst({
            where: {
              trustId: context.trustId,
              schoolId,
              academicYearId,
              studentProfileId: candidate.studentProfileId,
              ruleKey: attendanceReviewRule.key,
              ruleVersion: attendanceReviewRule.version,
              observedOn,
            },
          });
          if (existing) continue;
          const indicator = await transaction.studentSupportIndicator.create({
            data: {
              trustId: context.trustId,
              schoolId,
              campusId: candidate.campusId,
              academicYearId,
              studentProfileId: candidate.studentProfileId,
              ruleKey: attendanceReviewRule.key,
              ruleVersion: attendanceReviewRule.version,
              observedOn,
              inputSnapshot: {
                totalRecords: candidate.totalRecords,
                presentFractionTotal: candidate.presentFractionTotal,
                thresholdBasisPoints: attendanceReviewRule.thresholdBasisPoints,
              },
              factors: candidate.factors,
              reasonSummary: candidate.reasonSummary,
            },
          });
          await transaction.studentSupportIndicatorEvent.create({
            data: {
              trustId: context.trustId,
              schoolId,
              indicatorId: indicator.id,
              action: "INDICATOR_CREATED",
              toStatus: "OPEN",
              note: "Created by a transparent attendance review rule; human verification required.",
              factors: candidate.factors,
              actorUserId: context.userId,
              occurredAt: now,
            },
          });
          created += 1;
        }
        await transaction.auditEvent.create({
          data: {
            trustId: context.trustId,
            schoolId,
            campusId,
            actorUserId: context.userId,
            action: "analytics.support_indicators_refreshed",
            resourceType: "StudentSupportIndicator",
            outcome: "SUCCEEDED",
            sensitivity: "SENSITIVE",
            correlationId: metadata.correlationId,
            metadata: {
              ruleVersion: attendanceReviewRule.version,
              candidates: created,
            },
          },
        });
        return {
          created,
          evaluated: observations.size,
          ruleVersion: attendanceReviewRule.version,
        };
      },
    );
  }

  private async reviewIndicator(
    context: AuthenticatedContext,
    input: Extract<AiAssistanceMutation, { action: "REVIEW_INDICATOR" }>,
    metadata: RequestMetadata,
    now: Date,
  ) {
    requirePermission(context, "analytics.support.review", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      campusId: context.campusId,
    });
    if (input.decision === "CORRECT" && !input.correctedFactors?.length)
      throw new Error("Corrected factors are required for a correction");
    const toStatus =
      input.decision === "CORRECT"
        ? "CORRECTED"
        : input.decision === "DISMISS"
          ? "DISMISSED"
          : input.decision === "RESOLVE"
            ? "RESOLVED"
            : "OPEN";
    return withTenant(
      this.database,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: metadata.correlationId,
      },
      async (transaction) => {
        const indicator = await transaction.studentSupportIndicator.findFirst({
          where: {
            trustId: context.trustId,
            schoolId: context.schoolId,
            id: input.indicatorId,
          },
        });
        if (!indicator) throw new Error("Support indicator was not found");
        const updated = await transaction.studentSupportIndicator.update({
          where: { id: indicator.id },
          data: {
            status: toStatus,
            ...(input.correctedFactors
              ? { factors: input.correctedFactors }
              : {}),
            reviewedBy: context.userId,
            reviewerNote: input.reviewerNote,
            reviewedAt: now,
          },
        });
        await Promise.all([
          transaction.studentSupportIndicatorEvent.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              indicatorId: indicator.id,
              action: input.decision,
              fromStatus: indicator.status,
              toStatus,
              note: input.reviewerNote,
              factors: input.correctedFactors,
              actorUserId: context.userId,
              occurredAt: now,
            },
          }),
          transaction.auditEvent.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              campusId: indicator.campusId,
              actorUserId: context.userId,
              action: "analytics.support_indicator_reviewed",
              resourceType: "StudentSupportIndicator",
              resourceId: indicator.id,
              outcome: "SUCCEEDED",
              sensitivity: "SENSITIVE",
              correlationId: metadata.correlationId,
              reasonCode: input.decision,
              metadata: { ruleVersion: indicator.ruleVersion },
            },
          }),
        ]);
        return { id: updated.id, status: updated.status };
      },
    );
  }
}

export type AiWorkspaceViewModel = Awaited<
  ReturnType<AiAssistanceService["workspace"]>
>;
