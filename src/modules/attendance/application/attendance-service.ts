import { createHash } from "node:crypto";

import {
  AttendanceApprovalStatus,
  AttendanceRecordSource,
  AttendanceSessionState,
  AttendanceSessionType,
  AttendanceStatusCategory,
  AuditOutcome,
  AuditSensitivity,
  EnrollmentStatus,
  RecordStatus,
  StaffAttendanceStatus,
  type Prisma,
  type PrismaClient,
} from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import type { RequestMetadata } from "@/modules/identity/domain/request-security";
import { authorize, requirePermission } from "@/server/authorization/authorize";
import { withTenant } from "@/server/database/tenant-context";

import {
  attendanceMutationSchema,
  attendanceWorkspaceQuerySchema,
  calculateAttendancePercentage,
  consecutiveAbsenceCount,
  isPreviousDay,
  type AttendanceMutation,
} from "../domain/attendance-contracts";
import {
  LocalAttendanceNotificationAdapter,
  type AttendanceNotificationAdapter,
} from "./notification-adapter";

interface AttendanceScope {
  trustId: string;
  schoolId: string;
  campusId: string;
  academicYearId: string;
}

function activeScope(context: AuthenticatedContext): AttendanceScope {
  if (!context.schoolId || !context.campusId || !context.academicYearId)
    throw new Error("Select a school, campus, and academic year");
  return {
    trustId: context.trustId,
    schoolId: context.schoolId,
    campusId: context.campusId,
    academicYearId: context.academicYearId,
  };
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function monthBounds(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year!, monthNumber! - 1, 1)),
    end: new Date(Date.UTC(year!, monthNumber!, 1)),
  };
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

function hasPermission(
  context: AuthenticatedContext,
  permission: string,
  scope: AttendanceScope,
): boolean {
  return authorize(context, permission, scope).allowed;
}

async function assertSectionAccess(
  tx: Prisma.TransactionClient,
  context: AuthenticatedContext,
  scope: AttendanceScope,
  sectionId: string,
  date: Date,
  permission = "attendance.session.mark",
) {
  requirePermission(context, permission, scope);
  await tx.section.findFirstOrThrow({
    where: { ...scope, id: sectionId, status: RecordStatus.ACTIVE },
    select: { id: true },
  });
  if (
    hasPermission(context, "attendance.classes.override", scope) ||
    hasPermission(context, "attendance.session.manage", scope)
  )
    return;
  const assignment = await tx.attendanceTeachingAssignment.findFirst({
    where: {
      ...scope,
      sectionId,
      teacherUserId: context.userId,
      status: RecordStatus.ACTIVE,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
    },
    select: { id: true },
  });
  if (!assignment) throw new Error("Teacher is not assigned to this section");
}

function localMinute(value: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  return hour * 60 + minute;
}

export class AttendanceService {
  constructor(
    private readonly client: PrismaClient,
    private readonly notifications: AttendanceNotificationAdapter = new LocalAttendanceNotificationAdapter(),
  ) {}

  async workspace(context: AuthenticatedContext, untrustedQuery: unknown) {
    const query = attendanceWorkspaceQuerySchema.parse(untrustedQuery);
    const scope = activeScope(context);
    requirePermission(context, "attendance.session.read", scope);
    const selectedDate = dateOnly(
      query.date ?? new Date().toISOString().slice(0, 10),
    );
    const month = query.month ?? selectedDate.toISOString().slice(0, 7);
    return withTenant(
      this.client,
      {
        trustId: scope.trustId,
        actorUserId: context.userId,
        correlationId: crypto.randomUUID(),
      },
      async (tx) => {
        const unrestricted =
          hasPermission(context, "attendance.classes.override", scope) ||
          hasPermission(context, "attendance.session.manage", scope);
        const sections = await tx.section.findMany({
          where: {
            ...scope,
            status: RecordStatus.ACTIVE,
            ...(unrestricted
              ? {}
              : {
                  teachingAssignments: {
                    some: {
                      teacherUserId: context.userId,
                      status: RecordStatus.ACTIVE,
                      effectiveFrom: { lte: selectedDate },
                      OR: [
                        { effectiveTo: null },
                        { effectiveTo: { gte: selectedDate } },
                      ],
                    },
                  },
                }),
          },
          select: {
            id: true,
            name: true,
            gradeClass: { select: { name: true } },
          },
          orderBy: [{ gradeClass: { level: "asc" } }, { name: "asc" }],
        });
        const sectionId = query.sectionId ?? sections[0]?.id;
        if (sectionId)
          await assertSectionAccess(
            tx,
            context,
            scope,
            sectionId,
            selectedDate,
            "attendance.session.read",
          );
        const [statuses, periods, roster, session, staffShifts] =
          await Promise.all([
            tx.attendanceStatusDefinition.findMany({
              where: {
                trustId: scope.trustId,
                schoolId: scope.schoolId,
                academicYearId: scope.academicYearId,
                status: RecordStatus.ACTIVE,
              },
              select: {
                id: true,
                code: true,
                name: true,
                category: true,
                countsAsPresent: true,
                presentFraction: true,
              },
              orderBy: [{ isSystem: "desc" }, { name: "asc" }],
            }),
            tx.period.findMany({
              where: {
                trustId: scope.trustId,
                schoolId: scope.schoolId,
                academicYearId: scope.academicYearId,
                status: RecordStatus.ACTIVE,
                OR: [{ campusId: scope.campusId }, { campusId: null }],
              },
              select: { id: true, name: true, sequence: true },
              orderBy: { sequence: "asc" },
            }),
            sectionId
              ? tx.studentEnrollment.findMany({
                  where: {
                    ...scope,
                    sectionId,
                    status: EnrollmentStatus.ACTIVE,
                    startsOn: { lte: selectedDate },
                    OR: [{ endsOn: null }, { endsOn: { gte: selectedDate } }],
                  },
                  select: {
                    id: true,
                    studentProfileId: true,
                    rollNumber: true,
                    studentProfile: {
                      select: {
                        studentNumber: true,
                        person: {
                          select: {
                            firstName: true,
                            lastName: true,
                            preferredName: true,
                          },
                        },
                      },
                    },
                  },
                  orderBy: [{ rollNumber: "asc" }],
                })
              : Promise.resolve([]),
            sectionId
              ? tx.studentAttendanceSession.findFirst({
                  where: {
                    ...scope,
                    sectionId,
                    attendanceDate: selectedDate,
                    periodId: query.periodId ?? null,
                    type: query.periodId
                      ? AttendanceSessionType.PERIOD
                      : AttendanceSessionType.DAILY,
                  },
                  include: {
                    records: {
                      select: {
                        id: true,
                        studentProfileId: true,
                        statusDefinitionId: true,
                        minutesLate: true,
                        note: true,
                      },
                    },
                    reopenRequests: {
                      where: { status: AttendanceApprovalStatus.PENDING },
                      select: { id: true, reason: true, createdAt: true },
                    },
                  },
                })
              : Promise.resolve(null),
            tx.staffShift.findMany({
              where: {
                trustId: scope.trustId,
                schoolId: scope.schoolId,
                campusId: scope.campusId,
                status: RecordStatus.ACTIVE,
              },
              select: { id: true, code: true, name: true },
              orderBy: { name: "asc" },
            }),
          ]);
        const bounds = monthBounds(month);
        const records = await tx.studentAttendanceRecord.findMany({
          where: {
            ...scope,
            attendanceDate: { gte: bounds.start, lt: bounds.end },
            ...(sectionId ? { sectionId } : {}),
          },
          select: {
            studentProfileId: true,
            attendanceDate: true,
            statusDefinition: {
              select: { category: true, presentFraction: true },
            },
            studentProfile: {
              select: {
                studentNumber: true,
                person: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { attendanceDate: "asc" },
        });
        const grouped = new Map<string, typeof records>();
        for (const record of records)
          grouped.set(record.studentProfileId, [
            ...(grouped.get(record.studentProfileId) ?? []),
            record,
          ]);
        const summaries = [...grouped.values()].map((items) => ({
          studentProfileId: items[0]!.studentProfileId,
          studentNumber: items[0]!.studentProfile.studentNumber,
          name: `${items[0]!.studentProfile.person.firstName} ${items[0]!.studentProfile.person.lastName}`,
          markedDays: items.length,
          percentage: calculateAttendancePercentage(
            items.map((item) => item.statusDefinition.presentFraction),
          ),
          consecutiveAbsences: consecutiveAbsenceCount(
            items.map((item) => item.statusDefinition.category),
          ),
        }));
        const staffRecords = await tx.staffAttendanceRecord.findMany({
          where: {
            ...scope,
            attendanceDate: { gte: bounds.start, lt: bounds.end },
          },
          select: {
            staffProfileId: true,
            status: true,
            lateMinutes: true,
            earlyMinutes: true,
            staffProfile: {
              select: {
                employeeCode: true,
                person: { select: { firstName: true, lastName: true } },
              },
            },
          },
        });
        const staffGrouped = new Map<string, typeof staffRecords>();
        for (const record of staffRecords)
          staffGrouped.set(record.staffProfileId, [
            ...(staffGrouped.get(record.staffProfileId) ?? []),
            record,
          ]);
        const staffRoster = await tx.staffProfile.findMany({
          where: {
            trustId: scope.trustId,
            status: RecordStatus.ACTIVE,
            assignments: {
              some: {
                schoolId: scope.schoolId,
                campusId: scope.campusId,
                status: RecordStatus.ACTIVE,
              },
            },
          },
          select: {
            id: true,
            employeeCode: true,
            person: { select: { firstName: true, lastName: true } },
          },
          orderBy: { employeeCode: "asc" },
        });
        return {
          scope: { ...scope, date: selectedDate.toISOString().slice(0, 10) },
          permissions: {
            canMark: hasPermission(context, "attendance.session.mark", scope),
            canCorrect: hasPermission(
              context,
              "attendance.session.correct",
              scope,
            ),
            canLock: hasPermission(context, "attendance.session.lock", scope),
            canApproveReopen: hasPermission(
              context,
              "attendance.session.reopen.approve",
              scope,
            ),
            canMarkStaff: hasPermission(
              context,
              "attendance.staff.mark",
              scope,
            ),
          },
          sections,
          statuses,
          periods,
          roster,
          session,
          reports: {
            month,
            studentSummaries: summaries,
            defaulters: summaries.filter((item) => item.percentage < 75),
            consecutiveAbsenceAlerts: summaries.filter(
              (item) => item.consecutiveAbsences >= 3,
            ),
            staffSummaries: [...staffGrouped.values()].map((items) => ({
              staffProfileId: items[0]!.staffProfileId,
              employeeCode: items[0]!.staffProfile.employeeCode,
              name: `${items[0]!.staffProfile.person.firstName} ${items[0]!.staffProfile.person.lastName}`,
              markedDays: items.length,
              lateDays: items.filter(
                (item) => item.status === StaffAttendanceStatus.LATE,
              ).length,
              lateMinutes: items.reduce(
                (total, item) => total + item.lateMinutes,
                0,
              ),
              earlyMinutes: items.reduce(
                (total, item) => total + item.earlyMinutes,
                0,
              ),
            })),
          },
          staffShifts,
          staffRoster,
        };
      },
    );
  }

  async mutate(
    context: AuthenticatedContext,
    untrustedInput: AttendanceMutation,
    metadata: RequestMetadata,
  ) {
    const input = attendanceMutationSchema.parse(untrustedInput);
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
          case "student.bulk.submit":
            return this.submitStudentAttendance(
              tx,
              context,
              scope,
              input,
              metadata,
            );
          case "student.session.lock":
            return this.lockSession(
              tx,
              context,
              scope,
              input.sessionId,
              metadata,
            );
          case "student.session.reopen.request":
            return this.requestReopen(
              tx,
              context,
              scope,
              input.sessionId,
              input.reason,
              metadata,
            );
          case "student.session.reopen.decide":
            return this.decideReopen(tx, context, scope, input, metadata);
          case "student.leave.request":
            return this.requestStudentLeave(
              tx,
              context,
              scope,
              input,
              metadata,
            );
          case "student.leave.decide":
            return this.decideStudentLeave(tx, context, scope, input, metadata);
          case "status.create":
            return this.createStatus(tx, context, scope, input, metadata);
          case "staff.check":
            return this.recordStaffAttendance(
              tx,
              context,
              scope,
              input,
              metadata,
            );
          case "staff.correction.request":
            return this.requestStaffCorrection(
              tx,
              context,
              scope,
              input,
              metadata,
            );
          case "staff.correction.decide":
            return this.decideStaffCorrection(
              tx,
              context,
              scope,
              input,
              metadata,
            );
          case "staff.shift.assign":
            return this.assignShift(tx, context, scope, input, metadata);
          case "staff.leave.request":
            return this.requestStaffLeave(tx, context, scope, input, metadata);
          case "staff.leave.decide":
            return this.decideStaffLeave(tx, context, scope, input, metadata);
          case "device.event.ingest":
            return this.ingestDeviceEvent(tx, context, scope, input, metadata);
        }
      },
    );
  }

  private async submitStudentAttendance(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    input: Extract<AttendanceMutation, { action: "student.bulk.submit" }>,
    metadata: RequestMetadata,
  ) {
    const attendanceDate = dateOnly(input.date);
    await assertSectionAccess(
      tx,
      context,
      scope,
      input.sectionId,
      attendanceDate,
    );
    if (isPreviousDay(input.date)) {
      requirePermission(context, "attendance.session.correct", scope);
      if (!input.correctionReason)
        throw new Error("A correction reason is required for a previous day");
    }
    const codes = [
      ...new Set(input.records.map((record) => record.statusCode)),
    ];
    const statuses = await tx.attendanceStatusDefinition.findMany({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        academicYearId: scope.academicYearId,
        code: { in: codes },
        status: RecordStatus.ACTIVE,
      },
    });
    if (statuses.length !== codes.length)
      throw new Error("An attendance status is invalid or inactive");
    const statusByCode = new Map(
      statuses.map((status) => [status.code, status]),
    );
    const roster = await tx.studentEnrollment.findMany({
      where: {
        ...scope,
        sectionId: input.sectionId,
        id: { in: input.records.map((record) => record.enrollmentId) },
        status: EnrollmentStatus.ACTIVE,
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
      throw new Error(
        "Attendance contains a learner outside the section roster",
      );
    let session = await tx.studentAttendanceSession.findFirst({
      where: {
        ...scope,
        sectionId: input.sectionId,
        attendanceDate,
        periodId: input.periodId ?? null,
      },
    });
    if (session?.state === AttendanceSessionState.LOCKED)
      throw new Error("Attendance session is locked");
    if (!session)
      session = await tx.studentAttendanceSession.create({
        data: {
          ...scope,
          sectionId: input.sectionId,
          attendanceDate,
          periodId: input.periodId ?? null,
          type: input.periodId
            ? AttendanceSessionType.PERIOD
            : AttendanceSessionType.DAILY,
          markedBy: context.userId,
          clientSubmissionId: input.clientSubmissionId,
        },
      });
    const existingRecords = await tx.studentAttendanceRecord.findMany({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        sessionId: session.id,
        studentProfileId: {
          in: input.records.map((record) => record.studentProfileId),
        },
      },
    });
    const existingByStudent = new Map(
      existingRecords.map((record) => [record.studentProfileId, record]),
    );
    const changesExisting = input.records.some((item) => {
      const existing = existingByStudent.get(item.studentProfileId);
      return (
        existing &&
        existing.statusDefinitionId !== statusByCode.get(item.statusCode)!.id
      );
    });
    if (changesExisting) {
      requirePermission(context, "attendance.session.correct", scope);
      if (!input.correctionReason)
        throw new Error("A correction reason is required");
    }
    const saved = [];
    for (const item of input.records) {
      const status = statusByCode.get(item.statusCode)!;
      const existing = existingByStudent.get(item.studentProfileId);
      const record = await tx.studentAttendanceRecord.upsert({
        where: {
          trustId_schoolId_sessionId_studentProfileId: {
            trustId: scope.trustId,
            schoolId: scope.schoolId,
            sessionId: session.id,
            studentProfileId: item.studentProfileId,
          },
        },
        create: {
          ...scope,
          sectionId: input.sectionId,
          sessionId: session.id,
          enrollmentId: item.enrollmentId,
          studentProfileId: item.studentProfileId,
          statusDefinitionId: status.id,
          attendanceDate,
          source: AttendanceRecordSource.BULK,
          minutesLate: item.minutesLate,
          note: item.note,
        },
        update: {
          statusDefinitionId: status.id,
          minutesLate: item.minutesLate,
          note: item.note,
          source: AttendanceRecordSource.BULK,
        },
      });
      if (!existing || existing.statusDefinitionId !== status.id)
        await tx.studentAttendanceChange.create({
          data: {
            ...scope,
            sectionId: input.sectionId,
            recordId: record.id,
            actorUserId: context.userId,
            fromStatusId: existing?.statusDefinitionId,
            toStatusId: status.id,
            reason:
              input.correctionReason ??
              (existing ? "Attendance updated" : "Initial attendance marking"),
            source: AttendanceRecordSource.BULK,
          },
        });
      if (
        !existing &&
        (status.category === AttendanceStatusCategory.ABSENT ||
          status.category === AttendanceStatusCategory.MEDICAL_LEAVE)
      ) {
        const guardian = await tx.guardianRelationship.findFirst({
          where: {
            trustId: scope.trustId,
            studentProfileId: item.studentProfileId,
            receivesCommunication: true,
            status: RecordStatus.ACTIVE,
          },
          orderBy: [{ isPrimary: "desc" }, { priority: "asc" }],
          select: {
            guardianPerson: {
              select: {
                contacts: {
                  where: { status: RecordStatus.ACTIVE },
                  orderBy: { isPrimary: "desc" },
                  take: 1,
                  select: { value: true },
                },
              },
            },
          },
        });
        const recipient = guardian?.guardianPerson.contacts[0]?.value;
        if (recipient)
          await this.notifications.queue(tx, {
            ...scope,
            studentProfileId: item.studentProfileId,
            attendanceRecordId: record.id,
            templateKey: "attendance.student.absence",
            recipient,
            payload: { date: input.date, status: status.code },
          });
      }
      saved.push(record.id);
    }
    await audit(
      tx,
      context,
      metadata,
      changesExisting
        ? "attendance.student.corrected"
        : "attendance.student.submitted",
      "StudentAttendanceSession",
      session.id,
      {
        sectionId: input.sectionId,
        date: input.date,
        periodScoped: Boolean(input.periodId),
        recordCount: saved.length,
      },
    );
    return { sessionId: session.id, recordCount: saved.length };
  }

  private async lockSession(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    sessionId: string,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "attendance.session.lock", scope);
    const session = await tx.studentAttendanceSession.findFirstOrThrow({
      where: { ...scope, id: sessionId },
    });
    await tx.studentAttendanceSession.update({
      where: { id: session.id },
      data: {
        state: AttendanceSessionState.LOCKED,
        lockedAt: new Date(),
        lockedBy: context.userId,
        version: { increment: 1 },
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "attendance.session.locked",
      "StudentAttendanceSession",
      session.id,
      { from: session.state, to: AttendanceSessionState.LOCKED },
    );
    return { id: session.id, state: AttendanceSessionState.LOCKED };
  }

  private async requestReopen(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    sessionId: string,
    reason: string,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "attendance.session.reopen.request", scope);
    const session = await tx.studentAttendanceSession.findFirstOrThrow({
      where: { ...scope, id: sessionId },
    });
    if (session.state !== AttendanceSessionState.LOCKED)
      throw new Error("Only a locked attendance session can be reopened");
    const request = await tx.attendanceReopenRequest.create({
      data: {
        ...scope,
        sectionId: session.sectionId,
        sessionId: session.id,
        requestedBy: context.userId,
        reason,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "attendance.session.reopen_requested",
      "AttendanceReopenRequest",
      request.id,
      { sessionId: session.id },
    );
    return request;
  }

  private async decideReopen(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    input: Extract<
      AttendanceMutation,
      { action: "student.session.reopen.decide" }
    >,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "attendance.session.reopen.approve", scope);
    const request = await tx.attendanceReopenRequest.findFirstOrThrow({
      where: {
        ...scope,
        id: input.requestId,
        status: AttendanceApprovalStatus.PENDING,
      },
    });
    if (request.requestedBy === context.userId)
      throw new Error("A reopening request requires a different approver");
    const status = input.approve
      ? AttendanceApprovalStatus.APPROVED
      : AttendanceApprovalStatus.REJECTED;
    await tx.attendanceReopenRequest.update({
      where: { id: request.id },
      data: {
        status,
        decidedBy: context.userId,
        decidedAt: new Date(),
        decisionNote: input.note,
      },
    });
    if (input.approve)
      await tx.studentAttendanceSession.update({
        where: { id: request.sessionId },
        data: {
          state: AttendanceSessionState.OPEN,
          lockedAt: null,
          lockedBy: null,
          version: { increment: 1 },
        },
      });
    await audit(
      tx,
      context,
      metadata,
      input.approve
        ? "attendance.session.reopened"
        : "attendance.session.reopen_rejected",
      "AttendanceReopenRequest",
      request.id,
      { sessionId: request.sessionId, decision: status },
    );
    return { id: request.id, status };
  }

  private async requestStudentLeave(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    input: Extract<AttendanceMutation, { action: "student.leave.request" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "attendance.leave.request", scope);
    if (input.endsOn < input.startsOn)
      throw new Error("Leave end date cannot precede its start date");
    await tx.studentEnrollment.findFirstOrThrow({
      where: {
        ...scope,
        sectionId: input.sectionId,
        studentProfileId: input.studentProfileId,
      },
      select: { id: true },
    });
    const leave = await tx.studentLeaveRequest.create({
      data: {
        ...scope,
        sectionId: input.sectionId,
        studentProfileId: input.studentProfileId,
        requestedBy: context.userId,
        startsOn: dateOnly(input.startsOn),
        endsOn: dateOnly(input.endsOn),
        reason: input.reason,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "attendance.student_leave.requested",
      "StudentLeaveRequest",
      leave.id,
      { startsOn: input.startsOn, endsOn: input.endsOn },
    );
    return leave;
  }

  private async decideStudentLeave(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    input: Extract<AttendanceMutation, { action: "student.leave.decide" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "attendance.leave.manage", scope);
    const request = await tx.studentLeaveRequest.findFirstOrThrow({
      where: { ...scope, id: input.requestId, status: "PENDING" },
    });
    const status = input.approve ? "APPROVED" : "REJECTED";
    const leave = await tx.studentLeaveRequest.update({
      where: { id: request.id },
      data: {
        status,
        decidedBy: context.userId,
        decidedAt: new Date(),
        decisionNote: input.note,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "attendance.student_leave.decided",
      "StudentLeaveRequest",
      leave.id,
      { decision: status },
    );
    return leave;
  }

  private async createStatus(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    input: Extract<AttendanceMutation, { action: "status.create" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "attendance.status.manage", scope);
    const status = await tx.attendanceStatusDefinition.create({
      data: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        academicYearId: scope.academicYearId,
        code: input.code,
        name: input.name,
        category: AttendanceStatusCategory.CUSTOM,
        countsAsPresent: input.countsAsPresent,
        presentFraction: input.presentFraction,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "attendance.status.created",
      "AttendanceStatusDefinition",
      status.id,
      { code: status.code, presentFraction: status.presentFraction },
    );
    return status;
  }

  private async recordStaffAttendance(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    input: Extract<AttendanceMutation, { action: "staff.check" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "attendance.staff.mark", scope);
    const attendanceDate = dateOnly(input.date);
    await tx.staffAssignment.findFirstOrThrow({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        campusId: scope.campusId,
        staffProfileId: input.staffProfileId,
        status: RecordStatus.ACTIVE,
        effectiveFrom: { lte: attendanceDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: attendanceDate } }],
      },
      select: { id: true },
    });
    const assignment = await tx.staffShiftAssignment.findFirst({
      where: {
        ...scope,
        staffProfileId: input.staffProfileId,
        status: RecordStatus.ACTIVE,
        effectiveFrom: { lte: attendanceDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: attendanceDate } }],
      },
      include: { shift: true, campus: { select: { timezone: true } } },
    });
    const checkInAt = input.checkInAt ? new Date(input.checkInAt) : undefined;
    const checkOutAt = input.checkOutAt
      ? new Date(input.checkOutAt)
      : undefined;
    if (checkInAt && checkOutAt && checkOutAt < checkInAt)
      throw new Error("Check-out cannot precede check-in");
    const timezone = assignment?.campus.timezone ?? "Asia/Kolkata";
    const lateMinutes =
      checkInAt && assignment
        ? Math.max(
            0,
            localMinute(checkInAt, timezone) -
              assignment.shift.startsMinute -
              assignment.shift.graceMinutes,
          )
        : 0;
    const earlyMinutes =
      checkOutAt && assignment
        ? Math.max(
            0,
            assignment.shift.endsMinute -
              localMinute(checkOutAt, timezone) -
              assignment.shift.earlyDepartureMinutes,
          )
        : 0;
    const record = await tx.staffAttendanceRecord.upsert({
      where: {
        trustId_schoolId_campusId_academicYearId_staffProfileId_attendanceDate:
          { ...scope, staffProfileId: input.staffProfileId, attendanceDate },
      },
      create: {
        ...scope,
        staffProfileId: input.staffProfileId,
        shiftId: assignment?.shiftId,
        shiftAssignmentId: assignment?.id,
        attendanceDate,
        checkInAt,
        checkOutAt,
        status:
          lateMinutes > 0
            ? StaffAttendanceStatus.LATE
            : StaffAttendanceStatus.PRESENT,
        lateMinutes,
        earlyMinutes,
        source: input.source,
        actorUserId: context.userId,
      },
      update: {
        checkInAt,
        checkOutAt,
        status:
          lateMinutes > 0
            ? StaffAttendanceStatus.LATE
            : StaffAttendanceStatus.PRESENT,
        lateMinutes,
        earlyMinutes,
        source: input.source,
        actorUserId: context.userId,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "attendance.staff.recorded",
      "StaffAttendanceRecord",
      record.id,
      { date: input.date, lateMinutes, earlyMinutes, source: input.source },
    );
    return record;
  }

  private async requestStaffCorrection(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    input: Extract<AttendanceMutation, { action: "staff.correction.request" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "attendance.staff.correction.request", scope);
    const record = await tx.staffAttendanceRecord.findFirstOrThrow({
      where: { ...scope, id: input.attendanceRecordId },
    });
    const request = await tx.staffAttendanceCorrection.create({
      data: {
        ...scope,
        staffProfileId: record.staffProfileId,
        attendanceRecordId: record.id,
        requestedBy: context.userId,
        proposedCheckInAt: input.proposedCheckInAt
          ? new Date(input.proposedCheckInAt)
          : undefined,
        proposedCheckOutAt: input.proposedCheckOutAt
          ? new Date(input.proposedCheckOutAt)
          : undefined,
        reason: input.reason,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "attendance.staff_correction.requested",
      "StaffAttendanceCorrection",
      request.id,
      { attendanceRecordId: record.id },
    );
    return request;
  }

  private async decideStaffCorrection(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    input: Extract<AttendanceMutation, { action: "staff.correction.decide" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "attendance.staff.correct", scope);
    const request = await tx.staffAttendanceCorrection.findFirstOrThrow({
      where: { ...scope, id: input.requestId, status: "PENDING" },
    });
    if (request.requestedBy === context.userId)
      throw new Error("A correction request requires a different approver");
    const status = input.approve ? "APPROVED" : "REJECTED";
    await tx.staffAttendanceCorrection.update({
      where: { id: request.id },
      data: {
        status,
        decidedBy: context.userId,
        decidedAt: new Date(),
        decisionNote: input.note,
      },
    });
    if (input.approve)
      await tx.staffAttendanceRecord.update({
        where: { id: request.attendanceRecordId },
        data: {
          checkInAt: request.proposedCheckInAt,
          checkOutAt: request.proposedCheckOutAt,
          actorUserId: context.userId,
        },
      });
    await audit(
      tx,
      context,
      metadata,
      "attendance.staff_correction.decided",
      "StaffAttendanceCorrection",
      request.id,
      { decision: status },
    );
    return { id: request.id, status };
  }

  private async assignShift(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    input: Extract<AttendanceMutation, { action: "staff.shift.assign" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "attendance.shift.manage", scope);
    if (input.effectiveTo && input.effectiveTo < input.effectiveFrom)
      throw new Error("Shift assignment end date is invalid");
    await tx.staffShift.findFirstOrThrow({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        campusId: scope.campusId,
        id: input.shiftId,
        status: RecordStatus.ACTIVE,
      },
      select: { id: true },
    });
    const assignment = await tx.staffShiftAssignment.create({
      data: {
        ...scope,
        staffProfileId: input.staffProfileId,
        shiftId: input.shiftId,
        effectiveFrom: dateOnly(input.effectiveFrom),
        effectiveTo: input.effectiveTo
          ? dateOnly(input.effectiveTo)
          : undefined,
        assignedBy: context.userId,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "attendance.shift.assigned",
      "StaffShiftAssignment",
      assignment.id,
      { effectiveFrom: input.effectiveFrom },
    );
    return assignment;
  }

  private async requestStaffLeave(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    input: Extract<AttendanceMutation, { action: "staff.leave.request" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "attendance.staff.leave.request", scope);
    if (input.endsOn < input.startsOn)
      throw new Error("Leave end date cannot precede its start date");
    const leave = await tx.staffLeaveRequest.create({
      data: {
        ...scope,
        staffProfileId: input.staffProfileId,
        requestedBy: context.userId,
        startsOn: dateOnly(input.startsOn),
        endsOn: dateOnly(input.endsOn),
        leaveType: input.leaveType,
        reason: input.reason,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "attendance.staff_leave.requested",
      "StaffLeaveRequest",
      leave.id,
      { startsOn: input.startsOn, endsOn: input.endsOn },
    );
    return leave;
  }

  private async decideStaffLeave(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    input: Extract<AttendanceMutation, { action: "staff.leave.decide" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "attendance.staff.leave.manage", scope);
    const request = await tx.staffLeaveRequest.findFirstOrThrow({
      where: { ...scope, id: input.requestId, status: "PENDING" },
    });
    const status = input.approve ? "APPROVED" : "REJECTED";
    const leave = await tx.staffLeaveRequest.update({
      where: { id: request.id },
      data: {
        status,
        decidedBy: context.userId,
        decidedAt: new Date(),
        decisionNote: input.note,
      },
    });
    await audit(
      tx,
      context,
      metadata,
      "attendance.staff_leave.decided",
      "StaffLeaveRequest",
      leave.id,
      { decision: status },
    );
    return leave;
  }

  private async ingestDeviceEvent(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    scope: AttendanceScope,
    input: Extract<AttendanceMutation, { action: "device.event.ingest" }>,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "attendance.device.ingest", scope);
    const device = await tx.attendanceDevice.findFirstOrThrow({
      where: {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        campusId: scope.campusId,
        id: input.deviceId,
        status: RecordStatus.ACTIVE,
      },
      select: { id: true, type: true },
    });
    const identifierHash = createHash("sha256")
      .update(`${scope.trustId}:${input.subjectToken}`)
      .digest("hex");
    const event = await tx.attendanceDeviceEvent.upsert({
      where: {
        trustId_schoolId_campusId_deviceId_externalEventId: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          campusId: scope.campusId,
          deviceId: device.id,
          externalEventId: input.externalEventId,
        },
      },
      create: {
        ...scope,
        deviceId: device.id,
        externalEventId: input.externalEventId,
        identifierHash,
        occurredAt: new Date(input.occurredAt),
        eventKind: input.eventKind,
        payload: input.payload as Prisma.InputJsonValue | undefined,
      },
      update: {},
    });
    await audit(
      tx,
      context,
      metadata,
      "attendance.device_event.received",
      "AttendanceDeviceEvent",
      event.id,
      { deviceType: device.type, eventKind: input.eventKind },
    );
    return { id: event.id, state: event.state };
  }
}
