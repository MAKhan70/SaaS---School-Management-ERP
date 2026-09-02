import { PrismaClient } from "@/generated/prisma";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const suffix = crypto.randomUUID().slice(0, 8);
const platformId = `platform_operations_${suffix}`;
const trustA = `trust_operations_a_${suffix}`;
const trustB = `trust_operations_b_${suffix}`;

describe("operational module tenant isolation", () => {
  beforeAll(async () => {
    await prisma.platform.create({
      data: {
        id: platformId,
        key: `operations-${suffix}`,
        name: "Synthetic Operations Platform",
      },
    });
    for (const [trustId, label] of [
      [trustA, "A"],
      [trustB, "B"],
    ] as const) {
      const schoolId = `school_operations_${label.toLowerCase()}_${suffix}`;
      const userId = `user_operations_${label.toLowerCase()}_${suffix}`;
      await prisma.trust.create({
        data: {
          id: trustId,
          platformId,
          slug: `operations-${label.toLowerCase()}-${suffix}`,
          name: `Synthetic Operations Trust ${label}`,
        },
      });
      await prisma.school.create({
        data: {
          id: schoolId,
          trustId,
          code: `OPS${label}${suffix}`,
          name: `Synthetic Operations School ${label}`,
        },
      });
      await prisma.user.create({
        data: {
          id: userId,
          email: `operations-${label.toLowerCase()}-${suffix}@example.test`,
        },
      });
      const record = await prisma.operationalRecord.create({
        data: {
          id: `operational_record_${label.toLowerCase()}_${suffix}`,
          trustId,
          schoolId,
          module: "INVENTORY",
          recordType: "ASSET",
          referenceNumber: `ASSET-${label}-${suffix}`.toUpperCase(),
          title: `Synthetic Asset ${label}`,
          state: "ACTIVE",
          createdBy: userId,
          updatedBy: userId,
        },
      });
      await prisma.operationalRecordEvent.create({
        data: {
          trustId,
          schoolId,
          recordId: record.id,
          module: "INVENTORY",
          action: "created",
          toState: "ACTIVE",
          actorUserId: userId,
        },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it("prevents one trust from reading another trust's records and events without application filters", async () => {
    const visible = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL ROLE nasaq_app");
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trustA}, true)`;
      return Promise.all([
        transaction.operationalRecord.findMany({
          where: { title: { startsWith: "Synthetic Asset" } },
        }),
        transaction.operationalRecordEvent.findMany({
          where: { action: "created" },
        }),
      ]);
    });
    expect(visible[0].map((item) => item.title)).toEqual(["Synthetic Asset A"]);
    expect(visible[0].some((item) => item.trustId === trustB)).toBe(false);
    expect(visible[1].every((item) => item.trustId === trustA)).toBe(true);
  });
});
