import { randomUUID } from "node:crypto";

import { PrismaClient } from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import { PlatformAdminService } from "@/modules/platform-admin/application/platform-admin-service";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const operatorId = "user_platform_admin_integration";
let context: AuthenticatedContext;

describe("NASAQ platform client provisioning", () => {
  beforeAll(async () => {
    const platform = await prisma.platform.upsert({
      where: { key: "nasaq" },
      update: {},
      create: {
        id: "platform_nasaq",
        key: "nasaq",
        name: "NASAQ Academic Systems",
      },
    });
    const permission = await prisma.permission.upsert({
      where: { key: "platform.clients.manage" },
      update: { status: "ACTIVE" },
      create: {
        platformId: platform.id,
        key: "platform.clients.manage",
        description: "Manage platform clients",
      },
    });
    await prisma.user.upsert({
      where: { email: "platform-operator@example.test" },
      update: { status: "ACTIVE" },
      create: {
        id: operatorId,
        email: "platform-operator@example.test",
        profile: { create: { displayName: "Fictional Platform Operator" } },
      },
    });
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
      const role = await transaction.role.upsert({
        where: { id: "role_platform_admin_integration" },
        update: { status: "ACTIVE" },
        create: {
          id: "role_platform_admin_integration",
          platformId: platform.id,
          key: "platform_test_operator",
          name: "Platform Test Operator",
          origin: "SYSTEM",
        },
      });
      await transaction.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
      await transaction.platformRoleAssignment.upsert({
        where: { userId_roleId: { userId: operatorId, roleId: role.id } },
        update: { status: "ACTIVE" },
        create: { userId: operatorId, roleId: role.id },
      });
      const trustAdmin = await transaction.role.findFirst({
        where: { platformId: platform.id, key: "trust_admin", trustId: null },
      });
      if (!trustAdmin)
        await transaction.role.create({
          data: {
            id: "role_system_trust_admin",
            platformId: platform.id,
            key: "trust_admin",
            name: "Trust Administrator",
            origin: "SYSTEM",
          },
        });
    });
    context = {
      sessionId: "session-platform-integration",
      userId: operatorId,
      displayName: "Fictional Platform Operator",
      email: "platform-operator@example.test",
      trustId: "control-plane",
      trustName: "NASAQ",
      schoolId: "control-plane",
      academicYearId: "control-plane",
      academicYearName: "Control plane",
      permissionKeys: [],
      permissionGrants: [],
      featureKeys: [],
      isPlatformOperator: true,
      schools: [],
    };
  });

  afterAll(async () => prisma.$disconnect());

  it("creates an isolated client, administrator invitation, and selected features atomically", async () => {
    const suffix = randomUUID().slice(0, 8);
    const result = await new PlatformAdminService(prisma, {
      async send() {
        return "SENT" as const;
      },
    }).provisionClient(
      context,
      {
        trustName: `Fictional Trust ${suffix}`,
        trustSlug: `fictional-${suffix}`,
        schoolName: "Fictional School",
        schoolCode: "FS",
        campusName: "Central Campus",
        campusCode: "MAIN",
        academicYearName: "Academic Year 2026–27",
        academicYearCode: "AY-2026-27",
        academicYearStartsOn: new Date("2026-04-01"),
        academicYearEndsOn: new Date("2027-03-31"),
        boardType: "CBSE",
        administratorFirstName: "Aarav",
        administratorLastName: "Mehta",
        administratorEmail: `administrator-${suffix}@example.test`,
        administratorPhone: "+919876543210",
        featureKeys: ["core", "students"],
      },
      { correlationId: `platform-${suffix}` },
      "https://erp.example.test",
    );

    expect(result.deliveryStatus).toBe("SENT");
    const evidence = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${result.trustId}, true)`;
      return Promise.all([
        transaction.school.count({ where: { trustId: result.trustId } }),
        transaction.staffInvitation.findFirst({
          where: { trustId: result.trustId, roleKey: "trust_admin" },
        }),
        transaction.tenantFeatureGrant.findMany({
          where: { trustId: result.trustId, enabled: true },
        }),
      ]);
    });
    expect(evidence[0]).toBe(1);
    expect(evidence[1]?.tokenHash).toBeTruthy();
    expect(evidence[1]).not.toHaveProperty("token");
    expect(evidence[2].map((grant) => grant.featureKey).sort()).toEqual([
      "core",
      "students",
    ]);

    const crossTenantSchools = await prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRawUnsafe("SET LOCAL ROLE nasaq_app");
        await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${"trust_saraswati_demo"}, true)`;
        return transaction.school.findMany({ where: { id: result.schoolId } });
      },
    );
    expect(crossTenantSchools).toEqual([]);
  }, 30_000);

  it("denies client listing without a global platform permission assignment", async () => {
    await expect(
      new PlatformAdminService(prisma).listClients({
        ...context,
        userId: "missing-user",
      }),
    ).rejects.toThrow("Access denied");
  });
});
