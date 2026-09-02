import { PrismaClient } from "@/generated/prisma";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const suffix = crypto.randomUUID().slice(0, 8);
const platformId = `platform_examination_isolation_${suffix}`;
const trustA = `trust_examination_isolation_a_${suffix}`;
const trustB = `trust_examination_isolation_b_${suffix}`;

describe("examination tenant isolation", () => {
  beforeAll(async () => {
    await prisma.platform.create({
      data: {
        id: platformId,
        key: `examination-isolation-${suffix}`,
        name: "Synthetic Examination Isolation Platform",
      },
    });
    for (const [trustId, label] of [
      [trustA, "A"],
      [trustB, "B"],
    ] as const) {
      const schoolId = `school_examination_isolation_${label.toLowerCase()}_${suffix}`;
      const boardId = `board_examination_isolation_${label.toLowerCase()}_${suffix}`;
      const scaleId = `scale_examination_isolation_${label.toLowerCase()}_${suffix}`;
      await prisma.trust.create({
        data: {
          id: trustId,
          platformId,
          slug: `examination-isolation-${label.toLowerCase()}-${suffix}`,
          name: `Synthetic Examination Trust ${label}`,
        },
      });
      await prisma.school.create({
        data: {
          id: schoolId,
          trustId,
          code: `EX${label}${suffix}`,
          name: `Synthetic Examination School ${label}`,
        },
      });
      await prisma.boardConfiguration.create({
        data: {
          id: boardId,
          trustId,
          schoolId,
          boardType: "CUSTOM",
          name: `Synthetic Board ${label}`,
          version: 1,
          rules: { configurable: true },
          effectiveFrom: new Date("2026-04-01"),
          status: "ACTIVE",
        },
      });
      await prisma.gradingScale.create({
        data: {
          id: scaleId,
          trustId,
          schoolId,
          code: "STANDARD",
          name: `Synthetic Scale ${label}`,
          version: 1,
          effectiveFrom: new Date("2026-04-01"),
          status: "ACTIVE",
        },
      });
      await prisma.examinationRuleSet.create({
        data: {
          trustId,
          schoolId,
          boardConfigurationId: boardId,
          gradingScaleId: scaleId,
          code: `RULE-${label}`,
          name: `Synthetic Rules ${label}`,
          version: 1,
          rules: {
            subjectAggregation: "EQUAL_SUBJECTS",
            exemptHandling: "EXCLUDE",
            percentageScale: 2,
          },
          effectiveFrom: new Date("2026-04-01"),
          createdBy: "user_demo_school_admin",
        },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it("prevents a trust from reading another trust's rule configurations even without an application filter", async () => {
    const visible = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL ROLE nasaq_app");
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trustA}, true)`;
      return transaction.examinationRuleSet.findMany({
        where: { code: { startsWith: "RULE-" } },
        orderBy: { code: "asc" },
      });
    });
    expect(visible.map((item) => item.name)).toEqual(["Synthetic Rules A"]);
    expect(visible.some((item) => item.trustId === trustB)).toBe(false);
  });
});
