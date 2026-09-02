import {
  AuditOutcome,
  AuditSensitivity,
  type OperationalRecordState,
  type Prisma,
  type PrismaClient,
} from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import type { RequestMetadata } from "@/modules/identity/domain/request-security";
import {
  operationalModule,
  type OperationalModuleDefinition,
} from "@/modules/operations/domain/operational-catalogue";
import {
  operationalMutationSchema,
  operationalWorkspaceQuerySchema,
} from "@/modules/operations/domain/operational-contracts";
import { requirePermission } from "@/server/authorization/authorize";
import { withTenant } from "@/server/database/tenant-context";

const transitions: Record<
  OperationalRecordState,
  readonly OperationalRecordState[]
> = {
  DRAFT: ["ACTIVE", "PENDING_APPROVAL", "ARCHIVED"],
  ACTIVE: ["PENDING_APPROVAL", "COMPLETED", "ARCHIVED"],
  PENDING_APPROVAL: ["APPROVED", "ACTIVE", "ARCHIVED"],
  APPROVED: ["ACTIVE", "COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionOperationalRecord(
  from: OperationalRecordState,
  to: OperationalRecordState,
): boolean {
  return transitions[from].includes(to);
}

function definitionFor(slug: string): OperationalModuleDefinition {
  const definition = operationalModule(slug);
  if (!definition) throw new Error("Operational module was not found");
  return definition;
}

function resource(context: AuthenticatedContext) {
  return {
    trustId: context.trustId,
    schoolId: context.schoolId,
    ...(context.campusId ? { campusId: context.campusId } : {}),
  };
}

function auditSensitivity(
  sensitivity: OperationalModuleDefinition["sensitivity"],
): AuditSensitivity {
  if (sensitivity === "RESTRICTED") return AuditSensitivity.RESTRICTED;
  if (sensitivity === "SENSITIVE") return AuditSensitivity.SENSITIVE;
  return AuditSensitivity.STANDARD;
}

function audit(
  transaction: Prisma.TransactionClient,
  context: AuthenticatedContext,
  metadata: RequestMetadata,
  definition: OperationalModuleDefinition,
  input: {
    action: string;
    resourceId: string;
    changes: Prisma.InputJsonValue;
    reasonCode?: string;
  },
) {
  return transaction.auditEvent.create({
    data: {
      trustId: context.trustId,
      schoolId: context.schoolId,
      campusId: context.campusId,
      actorUserId: context.userId,
      effectiveActorUserId: context.userId,
      action: input.action,
      resourceType: `operational.${definition.slug}`,
      resourceId: input.resourceId,
      outcome: AuditOutcome.SUCCEEDED,
      sensitivity: auditSensitivity(definition.sensitivity),
      correlationId: metadata.correlationId,
      reasonCode: input.reasonCode,
      changes: input.changes,
      metadata: {
        module: definition.key,
        ...(metadata.ipHash ? { ipHash: metadata.ipHash } : {}),
        ...(metadata.userAgentHash
          ? { userAgentHash: metadata.userAgentHash }
          : {}),
      },
    },
  });
}

export class OperationalService {
  constructor(private readonly database: PrismaClient) {}

  async workspace(
    context: AuthenticatedContext,
    slug: string,
    untrustedQuery: unknown,
  ) {
    const definition = definitionFor(slug);
    const query = operationalWorkspaceQuerySchema.parse(untrustedQuery);
    requirePermission(context, definition.readPermission, resource(context));

    return withTenant(
      this.database,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: crypto.randomUUID(),
      },
      async (transaction) => {
        const where = {
          trustId: context.trustId,
          schoolId: context.schoolId,
          module: definition.key,
          ...(context.campusId
            ? { OR: [{ campusId: null }, { campusId: context.campusId }] }
            : {}),
          ...(query.state ? { state: query.state } : {}),
          ...(query.recordType ? { recordType: query.recordType } : {}),
          ...(query.search
            ? {
                AND: [
                  {
                    OR: [
                      {
                        title: {
                          contains: query.search,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        referenceNumber: {
                          contains: query.search,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  },
                ],
              }
            : {}),
        };
        const [records, stateCounts] = await Promise.all([
          transaction.operationalRecord.findMany({
            where,
            select: {
              id: true,
              referenceNumber: true,
              recordType: true,
              title: true,
              summary: true,
              state: true,
              sensitivity: true,
              effectiveFrom: true,
              effectiveTo: true,
              version: true,
              updatedAt: true,
              assignee: {
                select: { profile: { select: { displayName: true } } },
              },
              events: {
                select: {
                  id: true,
                  action: true,
                  fromState: true,
                  toState: true,
                  reason: true,
                  occurredAt: true,
                },
                orderBy: { occurredAt: "desc" },
                take: 3,
              },
            },
            orderBy: { updatedAt: "desc" },
            take: 100,
          }),
          transaction.operationalRecord.groupBy({
            by: ["state"],
            where: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              module: definition.key,
              ...(context.campusId
                ? { OR: [{ campusId: null }, { campusId: context.campusId }] }
                : {}),
            },
            _count: true,
          }),
        ]);
        return {
          module: definition,
          canManage: context.permissionKeys.includes(
            definition.managePermission,
          ),
          filters: query,
          stateCounts: Object.fromEntries(
            stateCounts.map((item) => [item.state, item._count]),
          ),
          records: records.map((record) => ({
            ...record,
            summary:
              record.sensitivity === "STANDARD" ? record.summary : undefined,
            assigneeName: record.assignee?.profile?.displayName,
            assignee: undefined,
          })),
        };
      },
    );
  }

  async mutate(
    context: AuthenticatedContext,
    slug: string,
    untrustedInput: unknown,
    metadata: RequestMetadata,
  ) {
    const definition = definitionFor(slug);
    const input = operationalMutationSchema.parse(untrustedInput);
    requirePermission(context, definition.managePermission, resource(context));

    return withTenant(
      this.database,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: metadata.correlationId,
      },
      async (transaction) => {
        if (input.action === "create") {
          if (
            !definition.recordTypes.some(
              (recordType) => recordType.key === input.recordType,
            )
          )
            throw new Error("Record type is not valid for this module");
          if (definition.sensitivity !== "STANDARD" && input.details)
            throw new Error(
              "Sensitive operational details require a dedicated encrypted workflow",
            );
          if (input.assignedToUserId) {
            const member = await transaction.schoolMembership.findFirst({
              where: {
                trustId: context.trustId,
                schoolId: context.schoolId,
                userId: input.assignedToUserId,
                status: "ACTIVE",
              },
              select: { id: true },
            });
            if (!member)
              throw new Error("Assignee is outside the active school scope");
          }
          const record = await transaction.operationalRecord.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              campusId: context.campusId,
              academicYearId: context.academicYearId,
              module: definition.key,
              recordType: input.recordType,
              referenceNumber: input.referenceNumber,
              title: input.title,
              summary: input.summary,
              sensitivity: definition.sensitivity,
              details:
                definition.sensitivity === "STANDARD"
                  ? input.details
                  : undefined,
              effectiveFrom: input.effectiveFrom
                ? new Date(`${input.effectiveFrom}T00:00:00.000Z`)
                : undefined,
              effectiveTo: input.effectiveTo
                ? new Date(`${input.effectiveTo}T00:00:00.000Z`)
                : undefined,
              assignedToUserId: input.assignedToUserId,
              createdBy: context.userId,
              updatedBy: context.userId,
            },
          });
          await Promise.all([
            transaction.operationalRecordEvent.create({
              data: {
                trustId: context.trustId,
                schoolId: context.schoolId,
                recordId: record.id,
                module: definition.key,
                action: "created",
                toState: record.state,
                changes: {
                  recordType: record.recordType,
                  referenceNumber: record.referenceNumber,
                },
                actorUserId: context.userId,
              },
            }),
            audit(transaction, context, metadata, definition, {
              action: `${definition.slug}.record.created`,
              resourceId: record.id,
              changes: {
                state: record.state,
                recordType: record.recordType,
                sensitivity: record.sensitivity,
              },
            }),
          ]);
          return { id: record.id, version: record.version };
        }

        const record = await transaction.operationalRecord.findFirst({
          where: {
            id: input.recordId,
            trustId: context.trustId,
            schoolId: context.schoolId,
            module: definition.key,
            ...(context.campusId
              ? { OR: [{ campusId: null }, { campusId: context.campusId }] }
              : {}),
          },
        });
        if (!record) throw new Error("Operational record was not found");
        if (!canTransitionOperationalRecord(record.state, input.toState))
          throw new Error("Operational state transition is not allowed");
        const updated = await transaction.operationalRecord.updateMany({
          where: {
            id: record.id,
            trustId: context.trustId,
            schoolId: context.schoolId,
            version: input.expectedVersion,
            state: record.state,
          },
          data: {
            state: input.toState,
            version: { increment: 1 },
            updatedBy: context.userId,
            ...(input.toState === "ARCHIVED" ? { archivedAt: new Date() } : {}),
          },
        });
        if (updated.count !== 1)
          throw new Error("Operational record was changed by another user");
        await Promise.all([
          transaction.operationalRecordEvent.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              recordId: record.id,
              module: definition.key,
              action: "state.transitioned",
              fromState: record.state,
              toState: input.toState,
              reason:
                definition.sensitivity === "STANDARD"
                  ? input.reason
                  : "Restricted operational transition",
              changes: { version: input.expectedVersion + 1 },
              actorUserId: context.userId,
            },
          }),
          audit(transaction, context, metadata, definition, {
            action: `${definition.slug}.record.transitioned`,
            resourceId: record.id,
            reasonCode: "STATE_TRANSITION",
            changes: { fromState: record.state, toState: input.toState },
          }),
        ]);
        return { id: record.id, version: input.expectedVersion + 1 };
      },
    );
  }
}
