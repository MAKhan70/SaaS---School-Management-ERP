import { PrismaClient } from "@/generated/prisma";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const suffix = crypto.randomUUID().slice(0, 8);
const platformId = `platform_fee_isolation_${suffix}`;
const trustA = `trust_fee_isolation_a_${suffix}`;
const trustB = `trust_fee_isolation_b_${suffix}`;

describe("fee tenant isolation", () => {
  beforeAll(async () => {
    await prisma.platform.create({
      data: {
        id: platformId,
        key: `fee-isolation-${suffix}`,
        name: "Synthetic Fee Isolation Platform",
      },
    });
    for (const [trustId, label] of [
      [trustA, "A"],
      [trustB, "B"],
    ] as const) {
      const schoolId = `school_fee_isolation_${label.toLowerCase()}_${suffix}`;
      await prisma.trust.create({
        data: {
          id: trustId,
          platformId,
          slug: `fee-isolation-${label.toLowerCase()}-${suffix}`,
          name: `Synthetic Fee Trust ${label}`,
        },
      });
      await prisma.school.create({
        data: {
          id: schoolId,
          trustId,
          code: `FEE${label}${suffix}`,
          name: `Synthetic Fee School ${label}`,
        },
      });
      await prisma.feeCategory.create({
        data: {
          trustId,
          schoolId,
          code: `CATEGORY_${label}`,
          name: `Synthetic Category ${label}`,
        },
      });
    }
  });
  afterAll(async () => prisma.$disconnect());

  it("prevents one trust from reading another trust's fee configuration even without an application filter", async () => {
    const visible = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL ROLE nasaq_app");
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trustA}, true)`;
      return transaction.feeCategory.findMany({
        where: { code: { startsWith: "CATEGORY_" } },
        orderBy: { code: "asc" },
      });
    });
    expect(visible.map((item) => item.name)).toEqual(["Synthetic Category A"]);
    expect(visible.some((item) => item.trustId === trustB)).toBe(false);
  });
});
