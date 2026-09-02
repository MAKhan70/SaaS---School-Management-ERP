import { PrismaClient } from "@/generated/prisma";
import { AttendanceService } from "@/modules/attendance/application/attendance-service";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const service = new AttendanceService(prisma);

const scope = {
  trustId: "trust_saraswati_demo",
  schoolId: "school_saraswati_central_demo",
  campusId: "campus_cbse_pune_demo",
  academicYearId: "academic_year_2026_27_demo",
};

function context(
  userId: string,
  permissionKeys: string[],
  grantScope: "SCHOOL" | "CAMPUS",
): AuthenticatedContext {
  return {
    sessionId: `attendance-session-${userId}`,
    userId,
    displayName: "Synthetic Attendance User",
    email: `${userId}@example.test`,
    trustId: scope.trustId,
    trustName: "Saraswati Learning Trust (Demo)",
    schoolId: scope.schoolId,
    campusId: scope.campusId,
    academicYearId: scope.academicYearId,
    academicYearName: "Academic Year 2026–27",
    permissionKeys,
    permissionGrants: [
      {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        campusId: grantScope === "CAMPUS" ? scope.campusId : undefined,
        scope: grantScope,
        permissionKeys,
        effectiveFrom: new Date("2026-04-01"),
        active: true,
      },
    ],
    schools: [],
  };
}

const teacher = context(
  "user_demo_teacher",
  [
    "attendance.session.read",
    "attendance.session.mark",
    "attendance.session.correct",
    "attendance.session.reopen.request",
    "attendance.staff.mark",
    "attendance.staff.correction.request",
  ],
  "CAMPUS",
);
const administrator = context(
  "user_demo_school_admin",
  [
    "attendance.session.read",
    "attendance.session.mark",
    "attendance.session.manage",
    "attendance.session.correct",
    "attendance.session.lock",
    "attendance.session.reopen.approve",
    "attendance.classes.override",
    "attendance.staff.mark",
    "attendance.staff.correct",
  ],
  "SCHOOL",
);
const metadata = (name: string) => ({
  correlationId: `attendance-${name}-${Date.now()}`,
  ipHash: "attendance-integration",
});

let studentDate = "";
let atomicDate = "";

describe("student and staff attendance workflow", () => {
  beforeAll(async () => {
    const usedDates = new Set(
      (
        await prisma.studentAttendanceSession.findMany({
          where: {
            trustId: scope.trustId,
            schoolId: scope.schoolId,
            campusId: scope.campusId,
            academicYearId: scope.academicYearId,
            sectionId: "section_cbse_pune_8a_demo",
          },
          select: { attendanceDate: true },
        })
      ).map((item) => item.attendanceDate.toISOString().slice(0, 10)),
    );
    const availableDates = Array.from({ length: 334 }, (_, index) => {
      const date = new Date("2026-04-01T00:00:00.000Z");
      date.setUTCDate(date.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    }).filter((date) => !usedDates.has(date));
    if (!availableDates[0] || !availableDates[1])
      throw new Error("Attendance integration dates are exhausted");
    [studentDate, atomicDate] = availableDates;
  });

  afterAll(async () => prisma.$disconnect());

  it("submits atomically, prevents duplicates, locks, reopens by approval, and audits correction", async () => {
    const initial = await service.mutate(
      teacher,
      {
        action: "student.bulk.submit",
        sectionId: "section_cbse_pune_8a_demo",
        date: studentDate,
        clientSubmissionId: crypto.randomUUID(),
        correctionReason: "Integration setup for an unused register date.",
        records: [
          {
            enrollmentId: "student_enrollment_demo_2026_27",
            studentProfileId: "student_profile_demo",
            statusCode: "ABSENT",
          },
        ],
      },
      metadata("initial"),
    );
    if (!("recordCount" in initial))
      throw new Error("Expected a bulk attendance result");
    expect(initial.recordCount).toBe(1);
    await service.mutate(
      teacher,
      {
        action: "student.bulk.submit",
        sectionId: "section_cbse_pune_8a_demo",
        date: studentDate,
        clientSubmissionId: crypto.randomUUID(),
        correctionReason: "Idempotency check for the integration register.",
        records: [
          {
            enrollmentId: "student_enrollment_demo_2026_27",
            studentProfileId: "student_profile_demo",
            statusCode: "ABSENT",
          },
        ],
      },
      metadata("idempotent-record"),
    );
    expect(
      await prisma.studentAttendanceRecord.count({
        where: { sessionId: initial.sessionId },
      }),
    ).toBe(1);
    expect(
      await prisma.attendanceNotificationPreview.count({
        where: { attendanceRecord: { sessionId: initial.sessionId } },
      }),
    ).toBe(1);

    await service.mutate(
      administrator,
      { action: "student.session.lock", sessionId: initial.sessionId },
      metadata("lock"),
    );
    await expect(
      service.mutate(
        teacher,
        {
          action: "student.bulk.submit",
          sectionId: "section_cbse_pune_8a_demo",
          date: studentDate,
          clientSubmissionId: crypto.randomUUID(),
          correctionReason: "Locked-session rejection coverage.",
          records: [
            {
              enrollmentId: "student_enrollment_demo_2026_27",
              studentProfileId: "student_profile_demo",
              statusCode: "PRESENT",
            },
          ],
        },
        metadata("locked-rejection"),
      ),
    ).rejects.toThrow("locked");

    const reopening = await service.mutate(
      teacher,
      {
        action: "student.session.reopen.request",
        sessionId: initial.sessionId,
        reason: "The guardian supplied an approved correction.",
      },
      metadata("reopen-request"),
    );
    if (!("id" in reopening))
      throw new Error("Expected an attendance reopening request");
    await service.mutate(
      administrator,
      {
        action: "student.session.reopen.decide",
        requestId: reopening.id,
        approve: true,
        note: "Reviewed against the authorized leave record.",
      },
      metadata("reopen-approve"),
    );
    await service.mutate(
      administrator,
      {
        action: "student.bulk.submit",
        sectionId: "section_cbse_pune_8a_demo",
        date: studentDate,
        clientSubmissionId: crypto.randomUUID(),
        correctionReason: "Authorized correction after attendance reopening.",
        records: [
          {
            enrollmentId: "student_enrollment_demo_2026_27",
            studentProfileId: "student_profile_demo",
            statusCode: "PRESENT",
          },
        ],
      },
      metadata("correct"),
    );
    const completed = await prisma.studentAttendanceSession.findUniqueOrThrow({
      where: { id: initial.sessionId },
      include: { records: { include: { statusDefinition: true } } },
    });
    expect(completed.state).toBe("OPEN");
    expect(completed.records[0]?.statusDefinition.code).toBe("PRESENT");
    expect(
      await prisma.studentAttendanceChange.count({
        where: { recordId: completed.records[0]?.id },
      }),
    ).toBe(2);
    expect(
      await prisma.auditEvent.count({
        where: {
          resourceId: initial.sessionId,
          action: { startsWith: "attendance." },
        },
      }),
    ).toBeGreaterThanOrEqual(2);
  });

  it("denies a teacher access to an unassigned section", async () => {
    await expect(
      service.workspace(teacher, {
        sectionId: "section_cbse_pune_8b_demo",
        date: "2026-09-01",
      }),
    ).rejects.toThrow("not assigned");
  });

  it("rejects an invalid bulk roster without creating a partial session", async () => {
    const where = {
      trustId: scope.trustId,
      schoolId: scope.schoolId,
      campusId: scope.campusId,
      academicYearId: scope.academicYearId,
      sectionId: "section_cbse_pune_8a_demo",
      attendanceDate: new Date(`${atomicDate}T00:00:00.000Z`),
    };
    const before = await prisma.studentAttendanceSession.count({ where });
    await expect(
      service.mutate(
        administrator,
        {
          action: "student.bulk.submit",
          sectionId: "section_cbse_pune_8a_demo",
          date: atomicDate,
          clientSubmissionId: crypto.randomUUID(),
          correctionReason: "Atomic rejection integration coverage.",
          records: [
            {
              enrollmentId: "student_enrollment_demo_2026_27",
              studentProfileId: "student_profile_demo",
              statusCode: "PRESENT",
            },
            {
              enrollmentId: "outside-enrollment",
              studentProfileId: "outside-student",
              statusCode: "PRESENT",
            },
          ],
        },
        metadata("atomic-rejection"),
      ),
    ).rejects.toThrow("outside the section roster");
    expect(await prisma.studentAttendanceSession.count({ where })).toBe(before);
  });

  it("records staff check-in and requires separate approval for correction", async () => {
    const record = await service.mutate(
      teacher,
      {
        action: "staff.check",
        staffProfileId: "staff_profile_demo_teacher",
        date: "2026-09-01",
        checkInAt: "2026-09-01T08:20:00+05:30",
        source: "MANUAL",
      },
      metadata("staff-check"),
    );
    if (!("lateMinutes" in record) || !("id" in record))
      throw new Error("Expected a staff attendance record");
    expect(record.lateMinutes).toBe(10);
    const request = await service.mutate(
      teacher,
      {
        action: "staff.correction.request",
        attendanceRecordId: record.id,
        proposedCheckInAt: "2026-09-01T08:05:00+05:30",
        reason: "The authorized gate register shows the earlier time.",
      },
      metadata("staff-correction-request"),
    );
    if (!("id" in request))
      throw new Error("Expected a staff correction request");
    await service.mutate(
      administrator,
      {
        action: "staff.correction.decide",
        requestId: request.id,
        approve: true,
        note: "Gate register evidence verified.",
      },
      metadata("staff-correction-approve"),
    );
    expect(
      await prisma.staffAttendanceCorrection.findUniqueOrThrow({
        where: { id: request.id },
      }),
    ).toMatchObject({ status: "APPROVED", decidedBy: administrator.userId });
  });
});
