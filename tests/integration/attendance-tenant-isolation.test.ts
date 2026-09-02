import { PrismaClient, RecordStatus } from "@/generated/prisma";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const platformId = "platform_attendance_isolation";
const trustA = "trust_attendance_isolation_a";
const trustB = "trust_attendance_isolation_b";

describe("attendance tenant isolation", () => {
  beforeAll(async () => {
    await prisma.platform.upsert({
      where: { key: "attendance-isolation" },
      update: {},
      create: {
        id: platformId,
        key: "attendance-isolation",
        name: "Attendance Isolation Platform",
      },
    });
    for (const [trustId, suffix] of [
      [trustA, "a"],
      [trustB, "b"],
    ] as const) {
      const schoolId = `school_attendance_isolation_${suffix}`;
      const yearId = `year_attendance_isolation_${suffix}`;
      await prisma.trust.upsert({
        where: { slug: `attendance-isolation-${suffix}` },
        update: { status: RecordStatus.ACTIVE },
        create: {
          id: trustId,
          platformId,
          slug: `attendance-isolation-${suffix}`,
          name: `Attendance Isolation Trust ${suffix.toUpperCase()}`,
        },
      });
      await prisma.school.upsert({
        where: { trustId_code: { trustId, code: "ATT" } },
        update: {},
        create: {
          id: schoolId,
          trustId,
          code: "ATT",
          name: `Attendance School ${suffix.toUpperCase()}`,
        },
      });
      await prisma.academicYear.upsert({
        where: { trustId_code: { trustId, code: "2026-27" } },
        update: {},
        create: {
          id: yearId,
          trustId,
          schoolId,
          code: "2026-27",
          name: "Academic Year 2026-27",
          startsOn: new Date("2026-04-01"),
          endsOn: new Date("2027-03-31"),
        },
      });
      await prisma.attendanceStatusDefinition.upsert({
        where: {
          trustId_schoolId_academicYearId_code: {
            trustId,
            schoolId,
            academicYearId: yearId,
            code: "PRESENT",
          },
        },
        update: {},
        create: {
          trustId,
          schoolId,
          academicYearId: yearId,
          code: "PRESENT",
          name: `Present ${suffix.toUpperCase()}`,
          category: "PRESENT",
          countsAsPresent: true,
          presentFraction: 100,
        },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it("prevents one trust from reading another trust's attendance configuration without an application filter", async () => {
    const visible = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL ROLE nasaq_app");
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trustA}, true)`;
      return transaction.attendanceStatusDefinition.findMany({
        orderBy: { name: "asc" },
      });
    });
    expect(visible.map((item) => item.name)).toContain("Present A");
    expect(visible.map((item) => item.name)).not.toContain("Present B");
  });
});
