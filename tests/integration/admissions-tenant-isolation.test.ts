import { PrismaClient, RecordStatus } from "@/generated/prisma";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const platformId = "platform_admissions_isolation";
const trustA = "trust_admissions_isolation_a";
const trustB = "trust_admissions_isolation_b";

describe("admissions tenant isolation", () => {
  beforeAll(async () => {
    await prisma.platform.upsert({
      where: { key: "admissions-isolation" },
      update: {},
      create: {
        id: platformId,
        key: "admissions-isolation",
        name: "Admissions Isolation Platform",
      },
    });
    for (const [trustId, suffix] of [
      [trustA, "a"],
      [trustB, "b"],
    ] as const) {
      await prisma.trust.upsert({
        where: { slug: `admissions-isolation-${suffix}` },
        update: { status: RecordStatus.ACTIVE },
        create: {
          id: trustId,
          platformId,
          slug: `admissions-isolation-${suffix}`,
          name: `Admissions Isolation Trust ${suffix.toUpperCase()}`,
        },
      });
      await prisma.school.upsert({
        where: { trustId_code: { trustId, code: "ADM" } },
        update: {},
        create: {
          id: `school_admissions_isolation_${suffix}`,
          trustId,
          code: "ADM",
          name: `Admissions School ${suffix.toUpperCase()}`,
        },
      });
      await prisma.academicYear.upsert({
        where: { trustId_code: { trustId, code: "2026-27" } },
        update: {},
        create: {
          id: `year_admissions_isolation_${suffix}`,
          trustId,
          schoolId: `school_admissions_isolation_${suffix}`,
          code: "2026-27",
          name: "Academic Year 2026-27",
          startsOn: new Date("2026-04-01"),
          endsOn: new Date("2027-03-31"),
        },
      });
      await prisma.admissionApplication.upsert({
        where: {
          trustId_schoolId_referenceNumber: {
            trustId,
            schoolId: `school_admissions_isolation_${suffix}`,
            referenceNumber: `ISO-${suffix}`,
          },
        },
        update: {},
        create: {
          trustId,
          schoolId: `school_admissions_isolation_${suffix}`,
          academicYearId: `year_admissions_isolation_${suffix}`,
          referenceNumber: `ISO-${suffix}`,
          source: "INTEGRATION_TEST",
          applicantName: `Synthetic Applicant ${suffix.toUpperCase()}`,
        },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it("prevents one trust from seeing another trust's admission application even without an application filter", async () => {
    const visible = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL ROLE nasaq_app");
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trustA}, true)`;
      return transaction.admissionApplication.findMany({
        orderBy: { referenceNumber: "asc" },
      });
    });
    expect(visible.map((item) => item.referenceNumber)).toContain("ISO-a");
    expect(visible.map((item) => item.referenceNumber)).not.toContain("ISO-b");
  });
});
