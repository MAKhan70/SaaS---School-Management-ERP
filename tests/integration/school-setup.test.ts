import { PrismaClient } from "@/generated/prisma";
import { SchoolSetupService } from "@/modules/academic-structure/application/school-setup-service";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const service = new SchoolSetupService(prisma);
const runId = Date.now().toString(36);
const ids = {
  platform: `platform_school_setup_${runId}`,
  user: `user_school_setup_${runId}`,
  trustA: `trust_school_setup_a_${runId}`,
  trustB: `trust_school_setup_b_${runId}`,
  schoolA: `school_school_setup_a_${runId}`,
  schoolB: `school_school_setup_b_${runId}`,
  yearA: `year_school_setup_a_${runId}`,
} as const;
const administratorEmail = `school-setup-admin-${runId}@example.test`;

const context: AuthenticatedContext = {
  sessionId: "session-school-setup",
  userId: ids.user,
  displayName: "Fictional Setup Administrator",
  email: administratorEmail,
  trustId: ids.trustA,
  trustName: "School Setup Trust A",
  schoolId: ids.schoolA,
  academicYearId: ids.yearA,
  academicYearName: "2026–27",
  permissionKeys: [
    "academic.structure.manage",
    "institutions.school.manage",
    "institutions.trust.manage",
  ],
  permissionGrants: [
    {
      trustId: ids.trustA,
      permissionKeys: [
        "academic.structure.manage",
        "institutions.school.manage",
        "institutions.trust.manage",
      ],
      scope: "TRUST",
      effectiveFrom: new Date("2026-01-01"),
      active: true,
    },
  ],
  schools: [],
};

async function seedTenant(
  trustId: string,
  schoolId: string,
  slug: string,
  withYear: boolean,
) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trustId}, true)`;
    await transaction.trust.upsert({
      where: { slug },
      update: { name: `${slug} Trust` },
      create: {
        id: trustId,
        platformId: ids.platform,
        slug,
        name: `${slug} Trust`,
      },
    });
    await transaction.school.upsert({
      where: { trustId_code: { trustId, code: "MAIN" } },
      update: { name: `${slug} School` },
      create: {
        id: schoolId,
        trustId,
        code: "MAIN",
        name: `${slug} School`,
      },
    });
    if (withYear)
      await transaction.academicYear.upsert({
        where: { trustId_code: { trustId, code: "2026-27-SETUP" } },
        update: { schoolId, status: "ACTIVE" },
        create: {
          id: ids.yearA,
          trustId,
          schoolId,
          code: "2026-27-SETUP",
          name: "Academic Year 2026–27",
          startsOn: new Date("2026-04-01"),
          endsOn: new Date("2027-03-31"),
          status: "ACTIVE",
        },
      });
  });
}

describe("school setup tenant isolation and academic-year rules", () => {
  beforeAll(async () => {
    await prisma.platform.upsert({
      where: { key: `school-setup-test-${runId}` },
      update: {},
      create: {
        id: ids.platform,
        key: `school-setup-test-${runId}`,
        name: "School Setup Test Platform",
      },
    });
    await prisma.user.upsert({
      where: { email: administratorEmail },
      update: { status: "ACTIVE" },
      create: {
        id: ids.user,
        email: administratorEmail,
        passwordHash: "not-a-real-credential",
        emailVerifiedAt: new Date(),
      },
    });
    await seedTenant(ids.trustA, ids.schoolA, `school-setup-a-${runId}`, true);
    await seedTenant(ids.trustB, ids.schoolB, `school-setup-b-${runId}`, false);
  });

  afterAll(async () => prisma.$disconnect());

  it("returns only the active trust and school configuration", async () => {
    const overview = await service.overview(context);
    expect(overview.school.id).toBe(ids.schoolA);
    expect(overview.school.id).not.toBe(ids.schoolB);
  });

  it("denies setup access without the server-side permission grant", async () => {
    await expect(
      service.overview({
        ...context,
        permissionKeys: [],
        permissionGrants: [],
      }),
    ).rejects.toThrow("Access denied");
  });

  it("rejects cross-school mutation even when the record ID is known", async () => {
    await expect(
      service.mutate(
        context,
        {
          action: "profile.update",
          resource: "school",
          resourceId: ids.schoolB,
          name: "Attempted cross-tenant update",
        },
        { correlationId: "cross-tenant-school-setup" },
      ),
    ).rejects.toThrow("outside active school");
    const schoolB = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${ids.trustB}, true)`;
      return transaction.school.findFirstOrThrow({
        where: { trustId: ids.trustB, id: ids.schoolB },
      });
    });
    expect(schoolB.name).toBe(`school-setup-b-${runId} School`);
  });

  it("rejects an overlapping active year and creates a non-overlapping future year with an audit event", async () => {
    await expect(
      service.mutate(
        context,
        {
          action: "academicYear.create",
          code: "OVERLAP-SETUP",
          name: "Overlapping Year",
          startsOn: "2027-01-01",
          endsOn: "2027-12-31",
          status: "ACTIVE",
        },
        { correlationId: "overlap-school-setup" },
      ),
    ).rejects.toThrow("overlaps");

    const created = await service.mutate(
      context,
      {
        action: "academicYear.create",
        code: "2027-28-SETUP",
        name: "Academic Year 2027–28",
        startsOn: "2027-04-01",
        endsOn: "2028-03-31",
        status: "PLANNED",
      },
      { correlationId: "future-school-setup" },
    );
    const auditCount = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${ids.trustA}, true)`;
      return transaction.auditEvent.count({
        where: { trustId: ids.trustA, resourceId: created.id },
      });
    });
    expect(auditCount).toBe(1);
  });

  it("copies reusable configuration into a planned future year without copying historical calendar dates", async () => {
    const metadata = { correlationId: "copy-school-setup" };
    await service.mutate(
      context,
      {
        action: "term.create",
        academicYearId: ids.yearA,
        code: "T1-COPY",
        name: "Configured Term",
        sequence: 1,
        startsOn: "2026-04-01",
        endsOn: "2026-09-30",
      },
      metadata,
    );
    await service.mutate(
      context,
      {
        action: "workingDays.replace",
        academicYearId: ids.yearA,
        weekdays: [1, 2, 3, 4, 5, 6],
      },
      metadata,
    );
    await service.mutate(
      context,
      {
        action: "period.create",
        academicYearId: ids.yearA,
        code: "P1-COPY",
        name: "Configured Period",
        sequence: 1,
        startsMinute: 540,
        endsMinute: 585,
        isInstruction: true,
      },
      metadata,
    );
    const copied = await service.mutate(
      context,
      {
        action: "academicYear.copy",
        sourceAcademicYearId: ids.yearA,
        code: "2028-29-COPY",
        name: "Academic Year 2028–29",
        startsOn: "2028-04-01",
        endsOn: "2029-03-31",
      },
      metadata,
    );
    const copiedConfiguration = await prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${ids.trustA}, true)`;
        return Promise.all([
          transaction.academicTerm.findMany({
            where: { trustId: ids.trustA, academicYearId: copied.id },
          }),
          transaction.workingDayRule.count({
            where: { trustId: ids.trustA, academicYearId: copied.id },
          }),
          transaction.period.count({
            where: { trustId: ids.trustA, academicYearId: copied.id },
          }),
          transaction.schoolCalendarDay.count({
            where: { trustId: ids.trustA, academicYearId: copied.id },
          }),
        ]);
      },
    );
    expect(copiedConfiguration[0][0]?.startsOn).toEqual(new Date("2028-04-01"));
    expect(copiedConfiguration.slice(1)).toEqual([7, 1, 0]);
  });
});
