import { PrismaClient } from "@/generated/prisma";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const suffix = crypto.randomUUID().slice(0, 8);
const platformId = `platform_analytics_${suffix}`;
const trustA = `trust_analytics_a_${suffix}`;
const trustB = `trust_analytics_b_${suffix}`;

describe("analytics and assistance tenant isolation", () => {
  beforeAll(async () => {
    await prisma.platform.create({
      data: {
        id: platformId,
        key: `analytics-${suffix}`,
        name: "Synthetic Analytics Platform",
      },
    });
    for (const [trustId, label] of [
      [trustA, "A"],
      [trustB, "B"],
    ] as const) {
      const lower = label.toLowerCase();
      const schoolId = `school_analytics_${lower}_${suffix}`;
      const campusId = `campus_analytics_${lower}_${suffix}`;
      const yearId = `year_analytics_${lower}_${suffix}`;
      const userId = `user_analytics_${lower}_${suffix}`;
      const studentId = `student_analytics_${lower}_${suffix}`;
      await prisma.trust.create({
        data: {
          id: trustId,
          platformId,
          slug: `analytics-${lower}-${suffix}`,
          name: `Synthetic Analytics Trust ${label}`,
        },
      });
      await prisma.school.create({
        data: {
          id: schoolId,
          trustId,
          code: `AN${label}${suffix}`,
          name: `Synthetic Analytics School ${label}`,
        },
      });
      await prisma.campus.create({
        data: {
          id: campusId,
          trustId,
          schoolId,
          code: `AN${label}`,
          name: `Synthetic Campus ${label}`,
        },
      });
      await prisma.academicYear.create({
        data: {
          id: yearId,
          trustId,
          schoolId,
          code: `AY-${suffix}`,
          name: "Synthetic 2026–27",
          startsOn: new Date("2026-04-01T00:00:00.000Z"),
          endsOn: new Date("2027-03-31T00:00:00.000Z"),
        },
      });
      await prisma.user.create({
        data: {
          id: userId,
          email: `analytics-${lower}-${suffix}@example.test`,
        },
      });
      const person = await prisma.person.create({
        data: {
          id: `person_analytics_${lower}_${suffix}`,
          trustId,
          firstName: "Synthetic",
          lastName: `Learner ${label}`,
        },
      });
      await prisma.studentProfile.create({
        data: {
          id: studentId,
          trustId,
          personId: person.id,
          studentNumber: `AN-${label}-${suffix}`,
        },
      });
      const record = await prisma.aiAssistanceRecord.create({
        data: {
          id: `ai_record_${lower}_${suffix}`,
          trustId,
          schoolId,
          campusId,
          academicYearId: yearId,
          feature: "ADMIN_REPORT_SUMMARY",
          provider: "LOCAL_MOCK",
          providerVersion: "test-local-1",
          inputSnapshot: { metric: "enrollment" },
          inputHash: "a".repeat(64),
          draftOutput: `Synthetic draft ${label}`,
          fallbackOutput: `Synthetic fallback ${label}`,
          createdBy: userId,
        },
      });
      await prisma.aiAssistanceAuditEvent.create({
        data: {
          trustId,
          schoolId,
          assistanceRecordId: record.id,
          action: "DRAFT_CREATED",
          providerVersion: record.providerVersion,
          inputHash: record.inputHash,
          outputHash: "b".repeat(64),
          actorUserId: userId,
        },
      });
      const indicator = await prisma.studentSupportIndicator.create({
        data: {
          trustId,
          schoolId,
          campusId,
          academicYearId: yearId,
          studentProfileId: studentId,
          ruleKey: "attendance.human_review",
          ruleVersion: "test-1",
          observedOn: new Date("2026-09-01T00:00:00.000Z"),
          inputSnapshot: { totalRecords: 8 },
          factors: [
            {
              key: "attendance",
              label: "Attendance",
              value: 72,
              explanation: "Synthetic",
            },
          ],
          reasonSummary: `Synthetic review reason ${label}`,
        },
      });
      await prisma.studentSupportIndicatorEvent.create({
        data: {
          trustId,
          schoolId,
          indicatorId: indicator.id,
          action: "INDICATOR_CREATED",
          toStatus: "OPEN",
          note: "Synthetic rule event",
          actorUserId: userId,
        },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it("prevents one trust from reading another trust's assistance and indicator records", async () => {
    const visible = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL ROLE nasaq_app");
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trustA}, true)`;
      return Promise.all([
        transaction.aiAssistanceRecord.findMany({
          where: { providerVersion: "test-local-1" },
        }),
        transaction.aiAssistanceAuditEvent.findMany({
          where: { action: "DRAFT_CREATED" },
        }),
        transaction.studentSupportIndicator.findMany({
          where: { ruleVersion: "test-1" },
        }),
        transaction.studentSupportIndicatorEvent.findMany({
          where: { action: "INDICATOR_CREATED" },
        }),
      ]);
    });
    for (const rows of visible) {
      expect(rows.every((row) => row.trustId === trustA)).toBe(true);
      expect(rows.some((row) => row.trustId === trustB)).toBe(false);
    }
  });
});
