import {
  AssignmentScope,
  MembershipStatus,
  PrismaClient,
  RoleOrigin,
} from "@/generated/prisma";
import {
  AuthenticationService,
  type PasswordResetDelivery,
} from "@/modules/identity/application/auth-service";
import { hashPassword } from "@/modules/identity/infrastructure/credential-crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const ids = {
  platform: "platform_auth_integration",
  trustA: "trust_auth_integration_a",
  trustB: "trust_auth_integration_b",
  schoolA: "school_auth_integration_a",
  schoolB: "school_auth_integration_b",
  yearA: "year_auth_integration_a",
  yearB: "year_auth_integration_b",
  user: "user_auth_integration",
  lockedUser: "user_auth_locked_integration",
  role: "role_auth_integration",
  permission: "permission_auth_integration",
} as const;
let permissionId: string = ids.permission;
const metadata = {
  correlationId: "auth-integration",
  ipHash: "ip-test",
  userAgentHash: "ua-test",
};

async function seedTrust(
  trustId: string,
  schoolId: string,
  yearId: string,
  slug: string,
) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trustId}, true)`;
    await transaction.trust.upsert({
      where: { slug },
      update: { status: "ACTIVE" },
      create: {
        id: trustId,
        platformId: ids.platform,
        slug,
        name: `${slug} Fictional Trust`,
      },
    });
    await transaction.school.upsert({
      where: { trustId_code: { trustId, code: "MAIN" } },
      update: { status: "ACTIVE" },
      create: { id: schoolId, trustId, code: "MAIN", name: `${slug} School` },
    });
    await transaction.academicYear.upsert({
      where: { trustId_code: { trustId, code: "2026-27" } },
      update: { status: "ACTIVE" },
      create: {
        id: yearId,
        trustId,
        code: "2026-27",
        name: "Academic Year 2026–27",
        startsOn: new Date("2026-04-01"),
        endsOn: new Date("2027-03-31"),
        status: "ACTIVE",
      },
    });
  });
}

describe("authentication and tenant context", () => {
  beforeAll(async () => {
    process.env.AUTH_SECRET = "integration-auth-secret-at-least-32-characters";
    await prisma.platform.upsert({
      where: { key: "auth-integration" },
      update: {},
      create: {
        id: ids.platform,
        key: "auth-integration",
        name: "Auth Integration Platform",
      },
    });
    permissionId = (
      await prisma.permission.upsert({
        where: { key: "institutions.school.manage" },
        update: {},
        create: {
          id: ids.permission,
          platformId: ids.platform,
          key: "institutions.school.manage",
          description: "Integration permission",
        },
      })
    ).id;
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
      await transaction.role.upsert({
        where: { id: ids.role },
        update: { status: "ACTIVE" },
        create: {
          id: ids.role,
          platformId: ids.platform,
          key: "auth_integration_admin",
          name: "Auth Integration Admin",
          origin: RoleOrigin.SYSTEM,
        },
      });
      await transaction.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: ids.role, permissionId } },
        update: {},
        create: { roleId: ids.role, permissionId },
      });
    });
    await seedTrust(ids.trustA, ids.schoolA, ids.yearA, "auth-integration-a");
    await seedTrust(ids.trustB, ids.schoolB, ids.yearB, "auth-integration-b");

    const passwordHash = await hashPassword("FictionalPass123");
    for (const [id, email] of [
      [ids.user, "auth-user@example.test"],
      [ids.lockedUser, "lock-user@example.test"],
    ] as const) {
      await prisma.user.upsert({
        where: { email },
        update: {
          passwordHash,
          status: "ACTIVE",
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        create: {
          id,
          email,
          passwordHash,
          profile: { create: { displayName: "Fictional Test User" } },
        },
      });
      await prisma.userTrustAccess.upsert({
        where: { userId_trustId: { userId: id, trustId: ids.trustA } },
        update: { status: MembershipStatus.ACTIVE },
        create: {
          userId: id,
          trustId: ids.trustA,
          effectiveFrom: new Date("2026-04-01"),
        },
      });
      await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${ids.trustA}, true)`;
        await transaction.schoolMembership.upsert({
          where: { id: `membership_${id}` },
          update: { status: MembershipStatus.ACTIVE },
          create: {
            id: `membership_${id}`,
            trustId: ids.trustA,
            userId: id,
            schoolId: ids.schoolA,
            effectiveFrom: new Date("2026-04-01"),
          },
        });
        await transaction.userRoleAssignment.upsert({
          where: { id: `assignment_${id}` },
          update: { status: "ACTIVE" },
          create: {
            id: `assignment_${id}`,
            trustId: ids.trustA,
            userId: id,
            roleId: ids.role,
            scope: AssignmentScope.TRUST,
            effectiveFrom: new Date("2026-04-01"),
          },
        });
      });
    }
  }, 60_000);

  afterAll(async () => prisma.$disconnect());

  it("creates a revocable opaque session with verified tenant context", async () => {
    const result = await new AuthenticationService(prisma).signIn(
      { email: "AUTH-USER@example.test", password: "FictionalPass123" },
      metadata,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.trustId).toBe(ids.trustA);
    expect(result.context.permissionKeys).toContain(
      "institutions.school.manage",
    );
    const stored = await prisma.session.findUniqueOrThrow({
      where: { id: result.context.sessionId },
    });
    expect(stored.tokenHash).not.toBe(result.sessionToken);
    await expect(
      new AuthenticationService(prisma).switchContext(
        result.sessionToken,
        {
          trustId: ids.trustB,
          schoolId: ids.schoolB,
          academicYearId: ids.yearB,
        },
        metadata,
      ),
    ).resolves.toBeNull();
  });

  it("locks an account after repeated failures without changing the public error", async () => {
    const service = new AuthenticationService(prisma);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.signIn(
          { email: "lock-user@example.test", password: "IncorrectPass123" },
          {
            ...metadata,
            correlationId: `lock-${attempt}`,
            ipHash: `lock-ip-${attempt}`,
          },
        ),
      ).resolves.toEqual({ ok: false, reason: "INVALID_CREDENTIALS" });
    }
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: ids.lockedUser },
    });
    expect(user.lockedUntil).toBeInstanceOf(Date);
    await expect(
      service.signIn(
        { email: "lock-user@example.test", password: "FictionalPass123" },
        { ...metadata, ipHash: "locked-correct" },
      ),
    ).resolves.toEqual({ ok: false, reason: "INVALID_CREDENTIALS" });
  }, 30_000);

  it("uses a generic recovery flow and invalidates existing sessions after reset", async () => {
    let deliveredToken: string | undefined;
    const delivery: PasswordResetDelivery = {
      async sendPasswordReset(input) {
        deliveredToken = input.token;
      },
    };
    const service = new AuthenticationService(prisma, delivery);
    const signIn = await service.signIn(
      { email: "auth-user@example.test", password: "FictionalPass123" },
      { ...metadata, ipHash: "reset-signin" },
    );
    expect(signIn.ok).toBe(true);
    if (!signIn.ok) return;
    await expect(
      service.requestPasswordReset(
        { email: "missing@example.test" },
        { ...metadata, ipHash: "missing-reset" },
      ),
    ).resolves.toBeUndefined();
    expect(deliveredToken).toBeUndefined();
    await service.requestPasswordReset(
      { email: "auth-user@example.test" },
      { ...metadata, ipHash: "known-reset" },
    );
    expect(deliveredToken).toBeTruthy();
    const reset = await service.resetPassword(
      {
        token: deliveredToken!,
        password: "ChangedPass123",
        confirmPassword: "ChangedPass123",
      },
      metadata,
    );
    expect(reset).toBe(true);
    await expect(
      service.authenticateSession(signIn.sessionToken),
    ).resolves.toBeNull();
  }, 30_000);
});
