import { PrismaClient } from "@/generated/prisma";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const suffix = crypto.randomUUID().slice(0, 8);
const platformId = `platform_dashboard_${suffix}`;
const trustA = `trust_dashboard_a_${suffix}`;
const trustB = `trust_dashboard_b_${suffix}`;

describe("dashboard tenant isolation", () => {
  beforeAll(async () => {
    await prisma.platform.create({
      data: {
        id: platformId,
        key: `dashboard-${suffix}`,
        name: "Synthetic Dashboard Platform",
      },
    });
    for (const [trustId, label] of [
      [trustA, "A"],
      [trustB, "B"],
    ] as const) {
      const schoolId = `school_dashboard_${label.toLowerCase()}_${suffix}`;
      const yearId = `year_dashboard_${label.toLowerCase()}_${suffix}`;
      const userId = `user_dashboard_${label.toLowerCase()}_${suffix}`;
      await prisma.trust.create({
        data: {
          id: trustId,
          platformId,
          slug: `dashboard-${label.toLowerCase()}-${suffix}`,
          name: `Synthetic Dashboard Trust ${label}`,
        },
      });
      await prisma.school.create({
        data: {
          id: schoolId,
          trustId,
          code: `DASH${label}${suffix}`,
          name: `Synthetic Dashboard School ${label}`,
        },
      });
      await prisma.academicYear.create({
        data: {
          id: yearId,
          trustId,
          schoolId,
          code: `AY-${label}-${suffix}`,
          name: `Synthetic Year ${label}`,
          startsOn: new Date("2026-04-01"),
          endsOn: new Date("2027-03-31"),
          status: "ACTIVE",
        },
      });
      await prisma.user.create({
        data: {
          id: userId,
          email: `dashboard-${label.toLowerCase()}-${suffix}@example.test`,
        },
      });
      await prisma.dashboardFeedItem.create({
        data: {
          id: `feed_dashboard_${label.toLowerCase()}_${suffix}`,
          trustId,
          schoolId,
          academicYearId: yearId,
          audience: "SCHOOL_ADMIN",
          kind: "OPERATIONAL_ALERT",
          title: `Synthetic alert ${label}`,
          createdBy: userId,
        },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it("prevents one trust from reading another trust's portal feed without an application filter", async () => {
    const visible = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL ROLE nasaq_app");
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trustA}, true)`;
      return transaction.dashboardFeedItem.findMany({
        where: { title: { startsWith: "Synthetic alert" } },
        orderBy: { title: "asc" },
      });
    });
    expect(visible.map((item) => item.title)).toEqual(["Synthetic alert A"]);
    expect(visible.some((item) => item.trustId === trustB)).toBe(false);
  });
});
