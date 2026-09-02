import {
  AdmissionFeeStatus,
  AdmissionFormKind,
  AdmissionScheduleStatus,
  AdmissionStage,
  AdmissionTaskStatus,
  AuditOutcome,
  AuditSensitivity,
  EnrollmentEventType,
  NumberingEntityType,
  Prisma,
  RateLimitAction,
  RecordStatus,
  StudentProfileStatus,
  type PrismaClient,
} from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import type { RequestMetadata } from "@/modules/identity/domain/request-security";
import {
  admissionFormDefinitionSchema,
  admissionQuerySchema,
  canTransitionAdmission,
  publicAdmissionSubmissionSchema,
  verifyPublicFormToken,
  type AdmissionMutation,
  type PublicAdmissionSubmission,
} from "@/modules/admissions/domain/admission-contracts";
import {
  duplicateFingerprint,
  normalizedContactHash,
} from "@/modules/students/domain/student-contracts";
import { authorize, requirePermission } from "@/server/authorization/authorize";
import { withTenant } from "@/server/database/tenant-context";
import {
  LocalPreviewAdmissionNotificationAdapter,
  type AdmissionNotificationAdapter,
} from "@/modules/admissions/application/notification-adapter";
import { consumePersistentRateLimit } from "@/server/security/persistent-rate-limit";

const PUBLIC_RATE_WINDOW_MS = 15 * 60 * 1000;
const PUBLIC_RATE_LIMIT = 8;

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function safeChanges(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function audit(
  tx: Prisma.TransactionClient,
  context: AuthenticatedContext,
  metadata: RequestMetadata,
  action: string,
  resourceId: string,
  changes?: Record<string, unknown>,
) {
  await tx.auditEvent.create({
    data: {
      trustId: context.trustId,
      schoolId: context.schoolId,
      campusId: context.campusId,
      actorUserId: context.userId,
      action,
      resourceType: "AdmissionApplication",
      resourceId,
      outcome: AuditOutcome.SUCCEEDED,
      sensitivity: AuditSensitivity.SENSITIVE,
      correlationId: metadata.correlationId,
      changes: changes ? safeChanges(changes) : undefined,
    },
  });
}

function assertFormAnswers(
  fieldsValue: Prisma.JsonValue,
  answers: Record<string, string | boolean>,
) {
  const definition = admissionFormDefinitionSchema.parse(fieldsValue);
  for (const field of definition.fields) {
    const value = answers[field.key];
    if (
      field.required &&
      (value === undefined || value === "" || value === false)
    )
      throw new Error(`Required field missing: ${field.key}`);
    if (
      value !== undefined &&
      field.type === "checkbox" &&
      typeof value !== "boolean"
    )
      throw new Error(`Invalid field value: ${field.key}`);
    if (
      value !== undefined &&
      field.type !== "checkbox" &&
      typeof value !== "string"
    )
      throw new Error(`Invalid field value: ${field.key}`);
    if (
      typeof value === "string" &&
      field.type === "email" &&
      !/^\S+@\S+\.\S+$/.test(value)
    )
      throw new Error(`Invalid field value: ${field.key}`);
    if (
      typeof value === "string" &&
      field.type === "select" &&
      !field.options?.includes(value)
    )
      throw new Error(`Invalid field value: ${field.key}`);
  }
}

export class PublicAdmissionService {
  constructor(private readonly prisma: PrismaClient) {}

  async form(publicKey: string) {
    const directory = await this.prisma.admissionPublicFormDirectory.findFirst({
      where: { publicKey, active: true },
    });
    if (!directory) throw new Error("Public admission form not found");
    return withTenant(
      this.prisma,
      { trustId: directory.trustId, correlationId: crypto.randomUUID() },
      async (tx) => {
        const form = await tx.admissionForm.findFirstOrThrow({
          where: {
            id: directory.formId,
            trustId: directory.trustId,
            schoolId: directory.schoolId,
            academicYearId: directory.academicYearId,
            status: "PUBLISHED",
          },
          include: {
            school: { select: { name: true } },
            academicYear: { select: { name: true } },
          },
        });
        const [seatPlans, occupied] = await Promise.all([
          tx.admissionSeatPlan.findMany({
            where: {
              trustId: directory.trustId,
              schoolId: directory.schoolId,
              academicYearId: directory.academicYearId,
              status: RecordStatus.ACTIVE,
            },
            include: { gradeClass: { select: { name: true } } },
          }),
          tx.admissionApplication.groupBy({
            by: ["targetGradeClassId", "stage"],
            where: {
              trustId: directory.trustId,
              schoolId: directory.schoolId,
              academicYearId: directory.academicYearId,
              targetGradeClassId: { not: null },
              stage: { in: [AdmissionStage.OFFERED, AdmissionStage.ADMITTED] },
            },
            _count: true,
          }),
        ]);
        return {
          publicKey,
          kind: form.kind,
          name: form.name,
          schoolName: form.school.name,
          academicYearName: form.academicYear.name,
          fields: admissionFormDefinitionSchema.parse(form.fields).fields,
          targetGrades: seatPlans.map((plan) => {
            const used = occupied
              .filter(
                (item) =>
                  item.targetGradeClassId === plan.gradeClassId &&
                  (item.stage === AdmissionStage.ADMITTED ||
                    (plan.holdOfferedSeats &&
                      item.stage === AdmissionStage.OFFERED)),
              )
              .reduce((sum, item) => sum + item._count, 0);
            return {
              id: plan.gradeClassId,
              name: plan.gradeClass.name,
              available: Math.max(0, plan.capacity - used),
            };
          }),
        };
      },
    );
  }

  async submit(
    publicKey: string,
    raw: PublicAdmissionSubmission,
    metadata: RequestMetadata,
  ) {
    const input = publicAdmissionSubmissionSchema.parse(raw);
    if (input.website) return { accepted: true };
    if (!verifyPublicFormToken(publicKey, input.formToken))
      throw new Error("Public form token is invalid or expired");
    const rateKey = `${publicKey}:${metadata.ipHash ?? "unknown"}:${normalizedContactHash(input.email ?? input.phone ?? "none")}`;
    if (
      !(await consumePersistentRateLimit(this.prisma, {
        action: RateLimitAction.PUBLIC_ADMISSIONS,
        key: rateKey,
        limit: PUBLIC_RATE_LIMIT,
        windowMs: PUBLIC_RATE_WINDOW_MS,
      }))
    )
      throw new Error("Public form rate limit exceeded");
    const directory = await this.prisma.admissionPublicFormDirectory.findFirst({
      where: { publicKey, active: true },
    });
    if (!directory) throw new Error("Public admission form not found");
    return withTenant(
      this.prisma,
      { trustId: directory.trustId, correlationId: metadata.correlationId },
      async (tx) => {
        const form = await tx.admissionForm.findFirstOrThrow({
          where: {
            id: directory.formId,
            trustId: directory.trustId,
            schoolId: directory.schoolId,
            status: "PUBLISHED",
          },
        });
        assertFormAnswers(form.fields, input.answers);
        if (
          form.kind === AdmissionFormKind.APPLICATION &&
          !input.targetGradeClassId
        )
          throw new Error("Target class is required for an application");
        if (input.targetGradeClassId)
          await tx.gradeClass.findFirstOrThrow({
            where: {
              id: input.targetGradeClassId,
              trustId: directory.trustId,
              schoolId: directory.schoolId,
              status: RecordStatus.ACTIVE,
            },
          });
        if (input.siblingStudentProfileId)
          await tx.studentAdmission.findFirstOrThrow({
            where: {
              trustId: directory.trustId,
              schoolId: directory.schoolId,
              studentProfileId: input.siblingStudentProfileId,
            },
          });
        const emailHash = input.email
          ? normalizedContactHash(input.email)
          : undefined;
        const phoneHash = input.phone
          ? normalizedContactHash(input.phone)
          : undefined;
        const possibleDuplicate = await tx.admissionApplication.findFirst({
          where: {
            trustId: directory.trustId,
            schoolId: directory.schoolId,
            archivedAt: null,
            OR: [
              ...(emailHash ? [{ emailHash }] : []),
              ...(phoneHash ? [{ phoneHash }] : []),
              ...(input.dateOfBirth
                ? [
                    {
                      applicantName: {
                        equals: input.applicantName,
                        mode: "insensitive" as const,
                      },
                      dateOfBirth: dateOnly(input.dateOfBirth),
                    },
                  ]
                : []),
            ],
          },
          orderBy: { createdAt: "desc" },
        });
        const referenceNumber = `ADM-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        const stage =
          form.kind === AdmissionFormKind.ENQUIRY
            ? AdmissionStage.ENQUIRY
            : AdmissionStage.APPLICATION_SUBMITTED;
        const application = await tx.admissionApplication.create({
          data: {
            trustId: directory.trustId,
            schoolId: directory.schoolId,
            academicYearId: directory.academicYearId,
            formId: form.id,
            targetGradeClassId: input.targetGradeClassId,
            siblingStudentProfileId: input.siblingStudentProfileId,
            possibleDuplicateOfId: possibleDuplicate?.id,
            referenceNumber,
            applicationNumber:
              form.kind === AdmissionFormKind.APPLICATION
                ? referenceNumber
                : undefined,
            stage,
            source: input.source,
            applicantName: input.applicantName,
            dateOfBirth: input.dateOfBirth
              ? dateOnly(input.dateOfBirth)
              : undefined,
            email: input.email,
            phone: input.phone,
            emailHash,
            phoneHash,
            answers: input.answers as Prisma.InputJsonValue,
            activities: {
              create:
                form.kind === AdmissionFormKind.APPLICATION
                  ? [
                      {
                        type: "APPLICATION_STARTED",
                        toStage: AdmissionStage.APPLICATION_STARTED,
                      },
                      {
                        type: "STATUS_CHANGED",
                        fromStage: AdmissionStage.APPLICATION_STARTED,
                        toStage: AdmissionStage.APPLICATION_SUBMITTED,
                      },
                    ]
                  : [
                      {
                        type: "ENQUIRY_CREATED",
                        toStage: AdmissionStage.ENQUIRY,
                      },
                    ],
            },
          },
        });
        await tx.auditEvent.create({
          data: {
            trustId: directory.trustId,
            schoolId: directory.schoolId,
            action: "admissions.public.submit",
            resourceType: "AdmissionApplication",
            resourceId: application.id,
            outcome: AuditOutcome.SUCCEEDED,
            sensitivity: AuditSensitivity.SENSITIVE,
            correlationId: metadata.correlationId,
            metadata: {
              formKind: form.kind,
              source: input.source,
              possibleDuplicate: Boolean(possibleDuplicate),
            },
          },
        });
        return { accepted: true, referenceNumber };
      },
    );
  }
}

export class AdmissionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notifications: AdmissionNotificationAdapter = new LocalPreviewAdmissionNotificationAdapter(),
  ) {}

  async dashboard(context: AuthenticatedContext, rawQuery: unknown) {
    requirePermission(context, "admissions.crm.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
    });
    const query = admissionQuerySchema.parse(rawQuery);
    const canReadAnalytics = authorize(context, "admissions.analytics.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
    }).allowed;
    return withTenant(
      this.prisma,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: context.sessionId,
      },
      async (tx) => {
        const scope = {
          trustId: context.trustId,
          schoolId: context.schoolId,
          academicYearId: context.academicYearId,
          ...(context.campusId
            ? { OR: [{ campusId: context.campusId }, { campusId: null }] }
            : {}),
        };
        const where: Prisma.AdmissionApplicationWhereInput = {
          ...scope,
          archivedAt: null,
          ...(query.stage ? { stage: query.stage } : {}),
          ...(query.counselorUserId
            ? { counselorUserId: query.counselorUserId }
            : {}),
          ...(query.gradeClassId
            ? { targetGradeClassId: query.gradeClassId }
            : {}),
          ...(query.search
            ? {
                OR: [
                  {
                    applicantName: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                  {
                    referenceNumber: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
        };
        const [applications, stageCounts, seatPlans, counselors, forms] =
          await Promise.all([
            tx.admissionApplication.findMany({
              where,
              orderBy: { updatedAt: "desc" },
              take: 100,
              select: {
                id: true,
                referenceNumber: true,
                applicantName: true,
                stage: true,
                source: true,
                updatedAt: true,
                possibleDuplicateOfId: true,
                targetGradeClass: { select: { name: true } },
                counselor: {
                  select: { profile: { select: { displayName: true } } },
                },
                followUps: {
                  where: { status: AdmissionTaskStatus.OPEN },
                  orderBy: { dueAt: "asc" },
                  take: 1,
                },
              },
            }),
            tx.admissionApplication.groupBy({
              by: ["stage"],
              where: scope,
              _count: true,
            }),
            tx.admissionSeatPlan.findMany({
              where: {
                trustId: context.trustId,
                schoolId: context.schoolId,
                academicYearId: context.academicYearId,
                status: RecordStatus.ACTIVE,
              },
              include: { gradeClass: { select: { name: true } } },
            }),
            tx.admissionApplication.groupBy({
              by: ["counselorUserId"],
              where: scope,
              _count: true,
            }),
            tx.admissionForm.findMany({
              where: {
                trustId: context.trustId,
                schoolId: context.schoolId,
                academicYearId: context.academicYearId,
                status: { not: "ARCHIVED" },
              },
              include: { publicEntries: { where: { active: true } } },
              orderBy: [{ kind: "asc" }, { version: "desc" }],
            }),
          ]);
        const occupied = await tx.admissionApplication.groupBy({
          by: ["targetGradeClassId", "stage"],
          where: {
            ...scope,
            targetGradeClassId: { not: null },
            stage: { in: [AdmissionStage.OFFERED, AdmissionStage.ADMITTED] },
          },
          _count: true,
        });
        const counselorProfiles = await tx.user.findMany({
          where: {
            id: {
              in: counselors
                .map((item) => item.counselorUserId)
                .filter((id): id is string => Boolean(id)),
            },
          },
          select: { id: true, profile: { select: { displayName: true } } },
        });
        return {
          applications,
          funnel: canReadAnalytics
            ? stageCounts.map((item) => ({
                stage: item.stage,
                count: item._count,
              }))
            : [],
          conversion: {
            total: canReadAnalytics
              ? stageCounts.reduce((sum, item) => sum + item._count, 0)
              : 0,
            admitted: canReadAnalytics
              ? (stageCounts.find(
                  (item) => item.stage === AdmissionStage.ADMITTED,
                )?._count ?? 0)
              : 0,
          },
          seats: seatPlans.map((plan) => {
            const used = occupied
              .filter(
                (item) =>
                  item.targetGradeClassId === plan.gradeClassId &&
                  (item.stage === AdmissionStage.ADMITTED ||
                    (plan.holdOfferedSeats &&
                      item.stage === AdmissionStage.OFFERED)),
              )
              .reduce((sum, item) => sum + item._count, 0);
            return {
              ...plan,
              used,
              available: Math.max(0, plan.capacity - used),
            };
          }),
          counselorProductivity: canReadAnalytics
            ? counselors.map((item) => ({
                counselorUserId: item.counselorUserId,
                counselorName:
                  counselorProfiles.find(
                    (profile) => profile.id === item.counselorUserId,
                  )?.profile?.displayName ?? "Unassigned",
                assigned: item._count,
              }))
            : [],
          forms,
        };
      },
    );
  }

  async detail(context: AuthenticatedContext, applicationId: string) {
    requirePermission(context, "admissions.crm.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
    });
    return withTenant(
      this.prisma,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: context.sessionId,
      },
      (tx) =>
        tx.admissionApplication.findFirstOrThrow({
          where: {
            id: applicationId,
            trustId: context.trustId,
            schoolId: context.schoolId,
            ...(context.campusId
              ? { OR: [{ campusId: context.campusId }, { campusId: null }] }
              : {}),
          },
          include: {
            targetGradeClass: true,
            counselor: { select: { profile: true } },
            activities: { orderBy: { occurredAt: "desc" } },
            followUps: { orderBy: { dueAt: "asc" } },
            documents: true,
            schedules: { orderBy: { scheduledFor: "asc" } },
            notificationPreviews: { orderBy: { createdAt: "desc" } },
            convertedStudent: { select: { id: true, studentNumber: true } },
          },
        }),
    );
  }

  async mutate(
    context: AuthenticatedContext,
    input: AdmissionMutation,
    metadata: RequestMetadata,
  ) {
    const decisionTransition =
      input.action === "stage.transition" &&
      ["OFFERED", "WAITLISTED", "ADMITTED", "REJECTED"].includes(input.to);
    const permission =
      input.action === "application.convert"
        ? "admissions.application.convert"
        : decisionTransition
          ? "admissions.application.review"
          : input.action === "seat-plan.upsert" ||
              input.action === "form.create" ||
              input.action === "form.publish"
            ? "admissions.forms.manage"
            : "admissions.crm.manage";
    requirePermission(context, permission, {
      trustId: context.trustId,
      schoolId: context.schoolId,
    });
    return withTenant(
      this.prisma,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: metadata.correlationId,
      },
      async (tx) => {
        if (input.action === "form.create") {
          admissionFormDefinitionSchema.parse({ fields: input.fields });
          await tx.academicYear.findFirstOrThrow({
            where: {
              id: input.academicYearId,
              trustId: context.trustId,
              schoolId: context.schoolId,
            },
          });
          const latest = await tx.admissionForm.findFirst({
            where: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              academicYearId: input.academicYearId,
              kind: input.kind,
              code: input.code,
            },
            orderBy: { version: "desc" },
            select: { version: true },
          });
          const form = await tx.admissionForm.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              academicYearId: input.academicYearId,
              kind: input.kind,
              code: input.code,
              name: input.name,
              version: (latest?.version ?? 0) + 1,
              fields: { fields: input.fields },
            },
          });
          await audit(
            tx,
            context,
            metadata,
            "admissions.form.create",
            form.id,
            { kind: input.kind, code: input.code, version: form.version },
          );
          return { id: form.id };
        }
        if (input.action === "form.publish") {
          const form = await tx.admissionForm.findFirstOrThrow({
            where: {
              id: input.formId,
              trustId: context.trustId,
              schoolId: context.schoolId,
              status: "DRAFT",
            },
          });
          const existingDirectory =
            await tx.admissionPublicFormDirectory.findUnique({
              where: { publicKey: input.publicKey },
            });
          if (
            existingDirectory &&
            (existingDirectory.trustId !== context.trustId ||
              existingDirectory.schoolId !== context.schoolId)
          )
            throw new Error("Public form key is already in use");
          await tx.admissionForm.update({
            where: {
              trustId_schoolId_id: {
                trustId: context.trustId,
                schoolId: context.schoolId,
                id: form.id,
              },
            },
            data: { status: "PUBLISHED", publishedAt: new Date() },
          });
          await tx.admissionPublicFormDirectory.upsert({
            where: { publicKey: input.publicKey },
            create: {
              publicKey: input.publicKey,
              formId: form.id,
              trustId: context.trustId,
              schoolId: context.schoolId,
              academicYearId: form.academicYearId,
              kind: form.kind,
            },
            update: {
              formId: form.id,
              trustId: context.trustId,
              schoolId: context.schoolId,
              academicYearId: form.academicYearId,
              kind: form.kind,
              active: true,
            },
          });
          await audit(
            tx,
            context,
            metadata,
            "admissions.form.publish",
            form.id,
            { publicKey: input.publicKey },
          );
          return { id: form.id, publicKey: input.publicKey };
        }
        if (input.action === "seat-plan.upsert") {
          const plan = await tx.admissionSeatPlan.upsert({
            where: {
              trustId_schoolId_academicYearId_gradeClassId: {
                trustId: context.trustId,
                schoolId: context.schoolId,
                academicYearId: input.academicYearId,
                gradeClassId: input.gradeClassId,
              },
            },
            create: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              academicYearId: input.academicYearId,
              gradeClassId: input.gradeClassId,
              capacity: input.capacity,
              holdOfferedSeats: input.holdOfferedSeats,
            },
            update: {
              capacity: input.capacity,
              holdOfferedSeats: input.holdOfferedSeats,
              status: RecordStatus.ACTIVE,
            },
          });
          await audit(
            tx,
            context,
            metadata,
            "admissions.seat-plan.upsert",
            plan.id,
            { capacity: input.capacity },
          );
          return { id: plan.id };
        }
        const application = await tx.admissionApplication.findFirstOrThrow({
          where: {
            id: input.applicationId,
            trustId: context.trustId,
            schoolId: context.schoolId,
            ...(context.campusId
              ? { OR: [{ campusId: context.campusId }, { campusId: null }] }
              : {}),
          },
        });
        if (input.action === "stage.transition")
          return this.transition(
            tx,
            context,
            application,
            input.to,
            input.reason,
            metadata,
          );
        if (input.action === "counselor.assign") {
          await tx.schoolMembership.findFirstOrThrow({
            where: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              userId: input.counselorUserId,
              status: "ACTIVE",
            },
          });
          await tx.admissionApplication.update({
            where: {
              trustId_schoolId_id: {
                trustId: context.trustId,
                schoolId: context.schoolId,
                id: application.id,
              },
            },
            data: {
              counselorUserId: input.counselorUserId,
              updatedBy: context.userId,
            },
          });
          await tx.admissionActivity.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              applicationId: application.id,
              actorUserId: context.userId,
              type: "COUNSELOR_ASSIGNED",
              metadata: { counselorUserId: input.counselorUserId },
            },
          });
          await audit(
            tx,
            context,
            metadata,
            "admissions.counselor.assign",
            application.id,
          );
        } else if (input.action === "note.add") {
          await tx.admissionActivity.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              applicationId: application.id,
              actorUserId: context.userId,
              type: "NOTE_ADDED",
              note: input.note,
            },
          });
          await audit(
            tx,
            context,
            metadata,
            "admissions.note.add",
            application.id,
          );
        } else if (input.action === "follow-up.create") {
          const followUp = await tx.admissionFollowUp.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              applicationId: application.id,
              assigneeUserId:
                input.assigneeUserId ?? application.counselorUserId,
              title: input.title,
              dueAt: new Date(input.dueAt),
            },
          });
          await tx.admissionActivity.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              applicationId: application.id,
              actorUserId: context.userId,
              type: "FOLLOW_UP_CREATED",
              metadata: { followUpId: followUp.id, dueAt: input.dueAt },
            },
          });
          await audit(
            tx,
            context,
            metadata,
            "admissions.follow-up.create",
            application.id,
          );
          return { id: followUp.id };
        } else if (input.action === "follow-up.complete") {
          await tx.admissionFollowUp.updateMany({
            where: {
              id: input.followUpId,
              trustId: context.trustId,
              schoolId: context.schoolId,
              applicationId: application.id,
            },
            data: {
              status: AdmissionTaskStatus.COMPLETED,
              completedAt: new Date(),
            },
          });
          await tx.admissionActivity.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              applicationId: application.id,
              actorUserId: context.userId,
              type: "FOLLOW_UP_COMPLETED",
              metadata: { followUpId: input.followUpId },
            },
          });
          await audit(
            tx,
            context,
            metadata,
            "admissions.follow-up.complete",
            application.id,
          );
        } else if (input.action === "document.upsert") {
          const document = await tx.admissionDocument.upsert({
            where: {
              trustId_schoolId_applicationId_code: {
                trustId: context.trustId,
                schoolId: context.schoolId,
                applicationId: application.id,
                code: input.code,
              },
            },
            create: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              applicationId: application.id,
              code: input.code,
              label: input.label,
              required: input.required,
              status: input.status,
              storageKey: input.storageKey,
              displayName: input.displayName,
              mimeType: input.mimeType,
              sizeBytes: input.sizeBytes,
              uploadedBy: input.storageKey ? context.userId : undefined,
            },
            update: {
              label: input.label,
              required: input.required,
              status: input.status,
              storageKey: input.storageKey,
              displayName: input.displayName,
              mimeType: input.mimeType,
              sizeBytes: input.sizeBytes,
              uploadedBy: input.storageKey ? context.userId : undefined,
            },
          });
          await audit(
            tx,
            context,
            metadata,
            "admissions.document.update",
            application.id,
            { documentId: document.id, status: input.status },
          );
          return { id: document.id };
        } else if (input.action === "fee.update") {
          await tx.admissionApplication.update({
            where: {
              trustId_schoolId_id: {
                trustId: context.trustId,
                schoolId: context.schoolId,
                id: application.id,
              },
            },
            data: {
              feeAmountMinor: input.amountMinor,
              feeCurrency: input.currency,
              feeStatus: input.status as AdmissionFeeStatus,
              feeReference: input.reference,
              updatedBy: context.userId,
            },
          });
          await tx.admissionActivity.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              applicationId: application.id,
              actorUserId: context.userId,
              type: "FEE_UPDATED",
              metadata: {
                amountMinor: input.amountMinor,
                currency: input.currency,
                status: input.status,
              },
            },
          });
          await audit(
            tx,
            context,
            metadata,
            "admissions.fee.update",
            application.id,
            {
              amountMinor: input.amountMinor,
              currency: input.currency,
              status: input.status,
            },
          );
        } else if (input.action === "schedule.create") {
          const schedule = await tx.admissionSchedule.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              applicationId: application.id,
              assigneeUserId: input.assigneeUserId,
              type: input.type,
              scheduledFor: new Date(input.scheduledFor),
              durationMinutes: input.durationMinutes,
              location: input.location,
              status: AdmissionScheduleStatus.SCHEDULED,
            },
          });
          await tx.admissionActivity.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              applicationId: application.id,
              actorUserId: context.userId,
              type: `${input.type}_SCHEDULED`,
              metadata: {
                scheduleId: schedule.id,
                scheduledFor: input.scheduledFor,
              },
            },
          });
          await audit(
            tx,
            context,
            metadata,
            "admissions.schedule.create",
            application.id,
            { type: input.type },
          );
          return { id: schedule.id };
        } else if (input.action === "application.convert") {
          return this.convert(tx, context, application, input, metadata);
        }
        return { id: application.id };
      },
    );
  }

  private async transition(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    application: {
      id: string;
      stage: AdmissionStage;
      email: string | null;
      phone: string | null;
    },
    to: AdmissionStage,
    reason: string,
    metadata: RequestMetadata,
  ) {
    if (!canTransitionAdmission(application.stage, to))
      throw new Error(
        `Transition from ${application.stage} to ${to} is not allowed`,
      );
    await tx.admissionApplication.update({
      where: {
        trustId_schoolId_id: {
          trustId: context.trustId,
          schoolId: context.schoolId,
          id: application.id,
        },
      },
      data: { stage: to, updatedBy: context.userId },
    });
    await tx.admissionActivity.create({
      data: {
        trustId: context.trustId,
        schoolId: context.schoolId,
        applicationId: application.id,
        actorUserId: context.userId,
        type: "STATUS_CHANGED",
        fromStage: application.stage,
        toStage: to,
        note: reason,
      },
    });
    if (to === AdmissionStage.OFFERED || to === AdmissionStage.REJECTED) {
      const recipient = application.email ?? application.phone;
      if (recipient)
        await this.notifications.preview(tx, {
          trustId: context.trustId,
          schoolId: context.schoolId,
          applicationId: application.id,
          channel: application.email ? "EMAIL" : "WHATSAPP",
          recipient,
          templateKey:
            to === AdmissionStage.OFFERED
              ? "admission.offer"
              : "admission.rejection",
        });
    }
    await audit(
      tx,
      context,
      metadata,
      "admissions.stage.transition",
      application.id,
      { from: application.stage, to, reasonProvided: true },
    );
    return { id: application.id, stage: to };
  }

  private async nextAdmissionNumber(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    academicYearId: string,
  ) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const rule = await tx.numberingRule.findFirst({
        where: {
          trustId: context.trustId,
          schoolId: context.schoolId,
          entityType: NumberingEntityType.STUDENT,
          status: RecordStatus.ACTIVE,
          OR: [{ academicYearId }, { academicYearId: null }],
        },
        orderBy: [{ academicYearId: "desc" }, { version: "desc" }],
      });
      if (!rule)
        throw new Error("Student admission numbering is not configured");
      const claimed = await tx.numberingRule.updateMany({
        where: {
          id: rule.id,
          trustId: context.trustId,
          nextNumber: rule.nextNumber,
        },
        data: { nextNumber: { increment: 1 } },
      });
      if (claimed.count === 1) {
        const [school, year] = await Promise.all([
          tx.school.findFirstOrThrow({
            where: { id: context.schoolId, trustId: context.trustId },
            select: { code: true },
          }),
          tx.academicYear.findFirstOrThrow({
            where: { id: academicYearId, trustId: context.trustId },
            select: { code: true },
          }),
        ]);
        const number = String(rule.nextNumber).padStart(rule.padding, "0");
        const render = (template: string) =>
          template
            .replaceAll("{SCHOOL}", school.code)
            .replaceAll("{YEAR}", year.code)
            .replaceAll("{NUMBER}", number);
        return `${render(rule.prefixTemplate)}${number}${rule.suffixTemplate ? render(rule.suffixTemplate) : ""}`;
      }
    }
    throw new Error("Could not reserve an admission number");
  }

  private async convert(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    application: {
      id: string;
      stage: AdmissionStage;
      convertedStudentProfileId: string | null;
      academicYearId: string;
      applicantName: string;
      dateOfBirth: Date | null;
      email: string | null;
      phone: string | null;
      targetGradeClassId: string | null;
    },
    input: Extract<AdmissionMutation, { action: "application.convert" }>,
    metadata: RequestMetadata,
  ) {
    const locked = await tx.$queryRaw<
      Array<{ converted_student_profile_id: string | null }>
    >`SELECT converted_student_profile_id FROM admission_applications WHERE trust_id = ${context.trustId} AND school_id = ${context.schoolId} AND id = ${application.id} FOR UPDATE`;
    const convertedId = locked[0]?.converted_student_profile_id;
    if (convertedId)
      return {
        id: application.id,
        studentProfileId: convertedId,
        idempotent: true,
      };
    if (application.stage !== AdmissionStage.ADMITTED)
      throw new Error("Only admitted applications can be converted");
    if (!application.dateOfBirth)
      throw new Error("Date of birth is required before conversion");
    const hashes = [application.email, application.phone]
      .filter((value): value is string => Boolean(value))
      .map(normalizedContactHash);
    const existing = await tx.studentProfile.findFirst({
      where: {
        trustId: context.trustId,
        admissions: { some: { schoolId: context.schoolId } },
        person: {
          OR: [
            { dateOfBirth: application.dateOfBirth },
            ...(hashes.length
              ? [{ contacts: { some: { normalizedHash: { in: hashes } } } }]
              : []),
          ],
        },
      },
      include: { person: { include: { contacts: true } } },
    });
    const [firstName, ...rest] = application.applicantName.trim().split(/\s+/);
    const lastName = rest.join(" ") || "Not provided";
    if (existing) {
      const exact =
        duplicateFingerprint({
          firstName: existing.person.firstName,
          lastName: existing.person.lastName,
          dateOfBirth:
            existing.person.dateOfBirth?.toISOString().slice(0, 10) ?? "",
        }) ===
          duplicateFingerprint({
            firstName: firstName ?? application.applicantName,
            lastName,
            dateOfBirth: application.dateOfBirth.toISOString().slice(0, 10),
          }) ||
        existing.person.contacts.some((contact) =>
          hashes.includes(contact.normalizedHash),
        );
      if (exact && !input.duplicateOverrideReason)
        throw new Error("Possible duplicate student found");
    }
    await tx.campus.findFirstOrThrow({
      where: {
        id: input.campusId,
        trustId: context.trustId,
        schoolId: context.schoolId,
        status: RecordStatus.ACTIVE,
      },
    });
    const section = input.sectionId
      ? await tx.section.findFirstOrThrow({
          where: {
            id: input.sectionId,
            trustId: context.trustId,
            schoolId: context.schoolId,
            campusId: input.campusId,
            academicYearId: application.academicYearId,
            ...(application.targetGradeClassId
              ? { gradeClassId: application.targetGradeClassId }
              : {}),
            status: RecordStatus.ACTIVE,
          },
        })
      : undefined;
    const admissionNumber = await this.nextAdmissionNumber(
      tx,
      context,
      application.academicYearId,
    );
    const person = await tx.person.create({
      data: {
        trustId: context.trustId,
        firstName: firstName ?? application.applicantName,
        lastName,
        dateOfBirth: application.dateOfBirth,
        contacts: {
          create: [
            ...(application.email
              ? [
                  {
                    type: "EMAIL" as const,
                    value: application.email,
                    normalizedHash: normalizedContactHash(application.email),
                    isPrimary: true,
                  },
                ]
              : []),
            ...(application.phone
              ? [
                  {
                    type: "PHONE" as const,
                    value: application.phone,
                    normalizedHash: normalizedContactHash(application.phone),
                    isPrimary: true,
                  },
                ]
              : []),
          ],
        },
      },
    });
    const student = await tx.studentProfile.create({
      data: {
        trustId: context.trustId,
        personId: person.id,
        studentNumber: admissionNumber,
        lifecycleStatus: section
          ? StudentProfileStatus.ACTIVE
          : StudentProfileStatus.ADMITTED,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
    });
    await tx.studentAdmission.create({
      data: {
        trustId: context.trustId,
        studentProfileId: student.id,
        schoolId: context.schoolId,
        campusId: input.campusId,
        academicYearId: application.academicYearId,
        admissionNumber,
        admittedOn: dateOnly(input.admissionDate),
        source: "ADMISSIONS_CRM",
      },
    });
    if (section) {
      const enrollment = await tx.studentEnrollment.create({
        data: {
          trustId: context.trustId,
          studentProfileId: student.id,
          schoolId: context.schoolId,
          campusId: input.campusId,
          academicYearId: application.academicYearId,
          sectionId: section.id,
          startsOn: dateOnly(input.admissionDate),
        },
      });
      await tx.studentEnrollmentEvent.create({
        data: {
          trustId: context.trustId,
          schoolId: context.schoolId,
          studentProfileId: student.id,
          type: EnrollmentEventType.ENROLLED,
          toEnrollmentId: enrollment.id,
          occurredOn: dateOnly(input.admissionDate),
          actorUserId: context.userId,
          details: { sourceApplicationId: application.id },
        },
      });
    }
    await tx.admissionApplication.update({
      where: {
        trustId_schoolId_id: {
          trustId: context.trustId,
          schoolId: context.schoolId,
          id: application.id,
        },
      },
      data: {
        convertedStudentProfileId: student.id,
        convertedAt: new Date(),
        campusId: input.campusId,
        updatedBy: context.userId,
      },
    });
    await tx.admissionActivity.create({
      data: {
        trustId: context.trustId,
        schoolId: context.schoolId,
        applicationId: application.id,
        actorUserId: context.userId,
        type: "CONVERTED_TO_STUDENT",
        metadata: {
          studentProfileId: student.id,
          duplicateOverride: Boolean(input.duplicateOverrideReason),
        },
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "admissions.application.convert",
      application.id,
      {
        studentProfileId: student.id,
        admissionNumber,
        duplicateOverride: Boolean(input.duplicateOverrideReason),
      },
    );
    return {
      id: application.id,
      studentProfileId: student.id,
      admissionNumber,
      idempotent: false,
    };
  }
}
