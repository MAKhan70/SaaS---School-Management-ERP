import {
  AuditOutcome,
  AuditSensitivity,
  AuthTokenType,
  MembershipStatus,
  RateLimitAction,
  RecordStatus,
  UserAccountStatus,
  type Prisma,
  type PrismaClient,
} from "@/generated/prisma";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  switchContextSchema,
  type SignInInput,
  type SwitchContextInput,
} from "@/modules/identity/domain/auth-contracts";
import type { RequestMetadata } from "@/modules/identity/domain/request-security";
import {
  createOpaqueToken,
  hashOpaqueValue,
  hashPassword,
  verifyPassword,
} from "@/modules/identity/infrastructure/credential-crypto";
import {
  permissionKeySchema,
  type PermissionGrant,
} from "@/modules/identity/authorization/permission-evaluator";
import { consumePersistentRateLimit } from "@/server/security/persistent-rate-limit";
import { featureForPermission } from "@/modules/platform-admin/domain/feature-catalogue";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_BLOCK_MS = 15 * 60 * 1000;
const LOCK_THRESHOLD = 5;
const LOCK_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH =
  "scrypt$16384$8$1$MDAwMDAwMDAwMDAwMDAwMA$TCy1OYh4XBzc_MVco8T_1E8KACfVe4oP5R4ZrP02NsiFFVfSqsRg1sk2vHBhx-E31pF-nsE1n5nq8TTcF8ksig";

type Database = PrismaClient | Prisma.TransactionClient;

export interface PasswordResetDelivery {
  sendPasswordReset(input: {
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void>;
}

export interface AuthenticatedContext {
  sessionId: string;
  userId: string;
  displayName: string;
  email: string;
  trustId: string;
  trustName: string;
  schoolId: string;
  campusId?: string;
  academicYearId: string;
  academicYearName: string;
  permissionKeys: readonly string[];
  permissionGrants: readonly PermissionGrant[];
  featureKeys?: readonly string[];
  supportAccessExpiresAt?: string;
  isPlatformOperator?: boolean;
  linkedChildPersonIds?: readonly string[];
  linkedChildStudentProfileIds?: readonly string[];
  schools: readonly {
    id: string;
    name: string;
    campuses: readonly { id: string; name: string }[];
  }[];
}

export type SignInResult =
  | { ok: true; sessionToken: string; context: AuthenticatedContext }
  | {
      ok: false;
      reason: "INVALID_CREDENTIALS" | "MFA_REQUIRED" | "RATE_LIMITED";
    };

function nowDateOnly(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

async function recordSecurityEvent(
  database: Database,
  input: RequestMetadata & {
    userId?: string;
    action: string;
    outcome: AuditOutcome;
    reasonCode?: string;
  },
): Promise<void> {
  await database.securityEvent.create({
    data: {
      userId: input.userId,
      action: input.action,
      outcome: input.outcome,
      reasonCode: input.reasonCode,
      correlationId: input.correlationId,
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
    },
  });
}

export class AuthenticationService {
  constructor(
    private readonly database: PrismaClient,
    private readonly resetDelivery?: PasswordResetDelivery,
  ) {}

  async signIn(
    untrustedInput: SignInInput,
    metadata: RequestMetadata,
    now = new Date(),
  ): Promise<SignInResult> {
    const input = signInSchema.parse(untrustedInput);
    const allowed = await consumePersistentRateLimit(
      this.database,
      {
        action: RateLimitAction.SIGN_IN,
        key: `${input.email}:${metadata.ipHash ?? "unknown"}`,
        limit: 10,
        windowMs: RATE_WINDOW_MS,
        blockMs: RATE_BLOCK_MS,
      },
      now,
    );
    if (!allowed) {
      await recordSecurityEvent(this.database, {
        ...metadata,
        action: "auth.sign_in",
        outcome: AuditOutcome.DENIED,
        reasonCode: "RATE_LIMITED",
      });
      return { ok: false, reason: "RATE_LIMITED" };
    }

    const user = await this.database.user.findUnique({
      where: { email: input.email },
    });
    const passwordMatches = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    const accountAvailable =
      user?.status === UserAccountStatus.ACTIVE &&
      (!user.lockedUntil || user.lockedUntil <= now);

    if (!user || !passwordMatches || !accountAvailable) {
      if (user && user.status === UserAccountStatus.ACTIVE) {
        const attempts = user.failedLoginAttempts + 1;
        await this.database.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: attempts,
            lockedUntil:
              attempts >= LOCK_THRESHOLD
                ? new Date(now.getTime() + LOCK_MS)
                : user.lockedUntil,
          },
        });
      }
      await recordSecurityEvent(this.database, {
        ...metadata,
        userId: user?.id,
        action: "auth.sign_in",
        outcome: AuditOutcome.DENIED,
        reasonCode: "INVALID_CREDENTIALS",
      });
      return { ok: false, reason: "INVALID_CREDENTIALS" };
    }

    if (user.mfaRequired) {
      await recordSecurityEvent(this.database, {
        ...metadata,
        userId: user.id,
        action: "auth.sign_in",
        outcome: AuditOutcome.DENIED,
        reasonCode: "MFA_REQUIRED",
      });
      return { ok: false, reason: "MFA_REQUIRED" };
    }

    const access = await this.database.userTrustAccess.findFirst({
      where: {
        userId: user.id,
        status: MembershipStatus.ACTIVE,
        effectiveFrom: { lte: nowDateOnly(now) },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: nowDateOnly(now) } }],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!access) {
      await recordSecurityEvent(this.database, {
        ...metadata,
        userId: user.id,
        action: "auth.sign_in",
        outcome: AuditOutcome.DENIED,
        reasonCode: "NO_ACTIVE_TENANT_ACCESS",
      });
      return { ok: false, reason: "INVALID_CREDENTIALS" };
    }

    const token = createOpaqueToken();
    const context = await this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${access.trustId}, true)`;
      const membership = await transaction.schoolMembership.findFirst({
        where: {
          trustId: access.trustId,
          userId: user.id,
          status: MembershipStatus.ACTIVE,
        },
        orderBy: { createdAt: "asc" },
      });
      const academicYear = await transaction.academicYear.findFirst({
        where: {
          trustId: access.trustId,
          status: "ACTIVE",
          OR: [{ schoolId: membership?.schoolId }, { schoolId: null }],
        },
        orderBy: { schoolId: "desc" },
      });
      if (!membership || !academicYear) return null;
      const activeCampusId =
        membership.campusId ??
        (
          await transaction.campus.findFirst({
            where: {
              trustId: access.trustId,
              schoolId: membership.schoolId,
              status: "ACTIVE",
            },
            orderBy: { createdAt: "asc" },
          })
        )?.id;

      const session = await transaction.session.create({
        data: {
          userId: user.id,
          tokenHash: hashOpaqueValue(token),
          activeTrustId: access.trustId,
          activeSchoolId: membership.schoolId,
          activeCampusId,
          activeAcademicYearId: academicYear.id,
          ipHash: metadata.ipHash,
          userAgentHash: metadata.userAgentHash,
          expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
        },
      });
      await transaction.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
      await transaction.auditEvent.create({
        data: {
          trustId: access.trustId,
          schoolId: membership.schoolId,
          campusId: membership.campusId,
          actorUserId: user.id,
          action: "auth.sign_in",
          resourceType: "Session",
          resourceId: session.id,
          outcome: AuditOutcome.SUCCEEDED,
          sensitivity: AuditSensitivity.SENSITIVE,
          correlationId: metadata.correlationId,
        },
      });
      return this.resolveContext(
        transaction,
        session.id,
        user.id,
        access.trustId,
        now,
      );
    });

    if (!context) return { ok: false, reason: "INVALID_CREDENTIALS" };
    await recordSecurityEvent(this.database, {
      ...metadata,
      userId: user.id,
      action: "auth.sign_in",
      outcome: AuditOutcome.SUCCEEDED,
    });
    return { ok: true, sessionToken: token, context };
  }

  async requestPasswordReset(
    untrustedInput: { email: string },
    metadata: RequestMetadata,
    now = new Date(),
  ): Promise<void> {
    const input = forgotPasswordSchema.parse(untrustedInput);
    const allowed = await consumePersistentRateLimit(
      this.database,
      {
        action: RateLimitAction.PASSWORD_RECOVERY,
        key: `${input.email}:${metadata.ipHash ?? "unknown"}`,
        limit: 5,
        windowMs: RATE_WINDOW_MS,
        blockMs: RATE_BLOCK_MS,
      },
      now,
    );
    if (!allowed) return;

    const user = await this.database.user.findUnique({
      where: { email: input.email },
    });
    if (!user || user.status !== UserAccountStatus.ACTIVE) return;

    const token = createOpaqueToken();
    const expiresAt = new Date(now.getTime() + RESET_TTL_MS);
    await this.database.$transaction([
      this.database.authToken.updateMany({
        where: {
          userId: user.id,
          type: AuthTokenType.PASSWORD_RESET,
          usedAt: null,
        },
        data: { usedAt: now },
      }),
      this.database.authToken.create({
        data: {
          userId: user.id,
          type: AuthTokenType.PASSWORD_RESET,
          tokenHash: hashOpaqueValue(token),
          expiresAt,
        },
      }),
      this.database.securityEvent.create({
        data: {
          userId: user.id,
          action: "auth.password_reset_requested",
          outcome: AuditOutcome.SUCCEEDED,
          correlationId: metadata.correlationId,
          ipHash: metadata.ipHash,
          userAgentHash: metadata.userAgentHash,
        },
      }),
    ]);
    await this.resetDelivery?.sendPasswordReset({
      email: input.email,
      token,
      expiresAt,
    });
  }

  async resetPassword(
    untrustedInput: {
      token: string;
      password: string;
      confirmPassword: string;
    },
    metadata: RequestMetadata,
    now = new Date(),
  ): Promise<boolean> {
    const input = resetPasswordSchema.parse(untrustedInput);
    const token = await this.database.authToken.findUnique({
      where: { tokenHash: hashOpaqueValue(input.token) },
    });
    if (
      !token ||
      token.type !== AuthTokenType.PASSWORD_RESET ||
      token.usedAt ||
      token.expiresAt <= now
    ) {
      return false;
    }

    const passwordHash = await hashPassword(input.password);
    await this.database.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: token.userId },
        data: {
          passwordHash,
          credentialsUpdatedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await transaction.authToken.update({
        where: { id: token.id },
        data: { usedAt: now },
      });
      await transaction.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await recordSecurityEvent(transaction, {
        ...metadata,
        userId: token.userId,
        action: "auth.password_reset_completed",
        outcome: AuditOutcome.SUCCEEDED,
      });
    });
    return true;
  }

  async authenticateSession(
    rawToken: string | undefined,
    now = new Date(),
  ): Promise<AuthenticatedContext | null> {
    if (!rawToken) return null;
    const session = await this.database.session.findUnique({
      where: { tokenHash: hashOpaqueValue(rawToken) },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.user.status !== UserAccountStatus.ACTIVE ||
      session.user.credentialsUpdatedAt > session.createdAt ||
      !session.activeTrustId
    )
      return null;

    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${session.activeTrustId}, true)`;
      return this.resolveContext(
        transaction,
        session.id,
        session.userId,
        session.activeTrustId!,
        now,
      );
    });
  }

  async switchContext(
    rawToken: string,
    untrustedInput: SwitchContextInput,
    metadata: RequestMetadata,
    now = new Date(),
  ): Promise<AuthenticatedContext | null> {
    const input = switchContextSchema.parse(untrustedInput);
    const session = await this.database.session.findUnique({
      where: { tokenHash: hashOpaqueValue(rawToken) },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.user.status !== UserAccountStatus.ACTIVE ||
      session.user.credentialsUpdatedAt > session.createdAt
    )
      return null;
    const access = await this.database.userTrustAccess.findUnique({
      where: {
        userId_trustId: { userId: session.userId, trustId: input.trustId },
      },
    });
    const today = nowDateOnly(now);
    if (
      !access ||
      access.status !== MembershipStatus.ACTIVE ||
      access.effectiveFrom > today ||
      (access.effectiveTo && access.effectiveTo < today)
    )
      return null;

    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${input.trustId}, true)`;
      const membership = await transaction.schoolMembership.findFirst({
        where: {
          trustId: input.trustId,
          userId: session.userId,
          schoolId: input.schoolId,
          status: MembershipStatus.ACTIVE,
          effectiveFrom: { lte: today },
          AND: [
            { OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }] },
          ],
          OR: [{ campusId: null }, { campusId: input.campusId }],
        },
      });
      const academicYear = await transaction.academicYear.findFirst({
        where: {
          trustId: input.trustId,
          id: input.academicYearId,
          OR: [{ schoolId: input.schoolId }, { schoolId: null }],
        },
      });
      if (!membership || !academicYear) return null;
      await transaction.session.update({
        where: { id: session.id },
        data: {
          activeTrustId: input.trustId,
          activeSchoolId: input.schoolId,
          activeCampusId: input.campusId,
          activeAcademicYearId: input.academicYearId,
          rotatedAt: now,
        },
      });
      await transaction.auditEvent.create({
        data: {
          trustId: input.trustId,
          schoolId: input.schoolId,
          campusId: input.campusId,
          actorUserId: session.userId,
          action: "auth.context_switched",
          resourceType: "Session",
          resourceId: session.id,
          outcome: AuditOutcome.SUCCEEDED,
          correlationId: metadata.correlationId,
        },
      });
      return this.resolveContext(
        transaction,
        session.id,
        session.userId,
        input.trustId,
        now,
      );
    });
  }

  async signOut(
    rawToken: string | undefined,
    metadata: RequestMetadata,
    now = new Date(),
  ): Promise<void> {
    if (!rawToken) return;
    const session = await this.database.session.findUnique({
      where: { tokenHash: hashOpaqueValue(rawToken) },
    });
    if (!session || session.revokedAt) return;
    await this.database.session.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });
    await recordSecurityEvent(this.database, {
      ...metadata,
      userId: session.userId,
      action: "auth.sign_out",
      outcome: AuditOutcome.SUCCEEDED,
    });
  }

  async revokeSession(
    rawToken: string,
    targetSessionId: string,
    metadata: RequestMetadata,
    now = new Date(),
  ): Promise<boolean> {
    const context = await this.authenticateSession(rawToken, now);
    if (!context) return false;
    const result = await this.database.session.updateMany({
      where: { id: targetSessionId, userId: context.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    if (result.count) {
      await recordSecurityEvent(this.database, {
        ...metadata,
        userId: context.userId,
        action: "auth.session_revoked",
        outcome: AuditOutcome.SUCCEEDED,
      });
    }
    return result.count === 1;
  }

  private async resolveContext(
    transaction: Prisma.TransactionClient,
    sessionId: string,
    userId: string,
    trustId: string,
    now: Date,
  ): Promise<AuthenticatedContext | null> {
    const [
      session,
      user,
      trust,
      memberships,
      assignments,
      featureGrants,
      supportAccess,
      platformAccess,
    ] = await Promise.all([
      transaction.session.findUnique({ where: { id: sessionId } }),
      transaction.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      }),
      transaction.trust.findUnique({ where: { id: trustId } }),
      transaction.schoolMembership.findMany({
        where: {
          trustId,
          userId,
          status: MembershipStatus.ACTIVE,
          effectiveFrom: { lte: nowDateOnly(now) },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: nowDateOnly(now) } },
          ],
        },
        include: { school: true, campus: true },
      }),
      transaction.userRoleAssignment.findMany({
        where: {
          trustId,
          userId,
          status: "ACTIVE",
          effectiveFrom: { lte: nowDateOnly(now) },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: nowDateOnly(now) } },
          ],
          role: { status: RecordStatus.ACTIVE },
          AND: [
            {
              OR: [
                { supportAccessGrantId: null },
                {
                  supportAccessGrant: {
                    revokedAt: null,
                    expiresAt: { gt: now },
                  },
                },
              ],
            },
          ],
        },
        include: {
          role: {
            include: {
              rolePermissions: {
                where: { permission: { status: RecordStatus.ACTIVE } },
                include: { permission: true },
              },
            },
          },
        },
      }),
      transaction.tenantFeatureGrant.findMany({
        where: { trustId, enabled: true },
        select: { featureKey: true },
      }),
      transaction.supportAccessGrant.findFirst({
        where: {
          trustId,
          actorUserId: userId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { expiresAt: "desc" },
      }),
      transaction.platformRoleAssignment.findFirst({
        where: {
          userId,
          status: "ACTIVE",
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
          role: { trustId: null, status: "ACTIVE" },
        },
      }),
    ]);
    if (
      !session?.activeSchoolId ||
      !session.activeAcademicYearId ||
      !user ||
      !trust
    )
      return null;
    const academicYear = await transaction.academicYear.findFirst({
      where: {
        trustId,
        id: session.activeAcademicYearId,
        OR: [{ schoolId: session.activeSchoolId }, { schoolId: null }],
      },
    });
    if (!academicYear) return null;
    const schoolWideIds = memberships
      .filter((membership) => !membership.campusId)
      .map((membership) => membership.schoolId);
    const schoolWideCampuses = schoolWideIds.length
      ? await transaction.campus.findMany({
          where: {
            trustId,
            schoolId: { in: schoolWideIds },
            status: "ACTIVE",
          },
          orderBy: { name: "asc" },
        })
      : [];
    const activeMembership = memberships.some(
      (membership) =>
        membership.schoolId === session.activeSchoolId &&
        (!membership.campusId ||
          membership.campusId === session.activeCampusId),
    );
    if (!activeMembership) return null;

    const linkedChildren = await transaction.guardianRelationship.findMany({
      where: {
        trustId,
        guardianPerson: { userId },
        status: RecordStatus.ACTIVE,
        effectiveFrom: { lte: nowDateOnly(now) },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: nowDateOnly(now) } }],
      },
      select: {
        studentProfileId: true,
        studentProfile: { select: { personId: true } },
      },
    });

    const schoolMap = new Map<
      string,
      { id: string; name: string; campuses: Map<string, string> }
    >();
    for (const membership of memberships) {
      const entry = schoolMap.get(membership.schoolId) ?? {
        id: membership.schoolId,
        name: membership.school.name,
        campuses: new Map<string, string>(),
      };
      if (membership.campus)
        entry.campuses.set(membership.campus.id, membership.campus.name);
      if (!membership.campusId) {
        for (const campus of schoolWideCampuses.filter(
          (candidate) => candidate.schoolId === membership.schoolId,
        )) {
          entry.campuses.set(campus.id, campus.name);
        }
      }
      schoolMap.set(membership.schoolId, entry);
    }
    const enabledFeatures = new Set(
      featureGrants.map((grant) => grant.featureKey),
    );
    const hasFeatureConfiguration = featureGrants.length > 0;
    const permissionGrants = assignments.map((assignment) => ({
      trustId,
      permissionKeys: assignment.role.rolePermissions
        .map((item) => permissionKeySchema.parse(item.permission.key))
        .filter((key) => {
          const feature = featureForPermission(key);
          return (
            !hasFeatureConfiguration || !feature || enabledFeatures.has(feature)
          );
        }),
      scope: assignment.scope,
      schoolId: assignment.schoolId ?? undefined,
      campusId: assignment.campusId ?? undefined,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo ?? undefined,
      active: true,
    })) satisfies PermissionGrant[];
    return {
      sessionId,
      userId,
      displayName: user.profile?.displayName ?? user.email,
      email: user.email,
      trustId,
      trustName: trust.name,
      schoolId: session.activeSchoolId,
      campusId: session.activeCampusId ?? undefined,
      academicYearId: session.activeAcademicYearId,
      academicYearName: academicYear.name,
      permissionKeys: [
        ...new Set(permissionGrants.flatMap((grant) => grant.permissionKeys)),
      ],
      permissionGrants,
      featureKeys: [...enabledFeatures],
      supportAccessExpiresAt: supportAccess?.expiresAt.toISOString(),
      isPlatformOperator: Boolean(platformAccess),
      linkedChildPersonIds: linkedChildren.map(
        (relationship) => relationship.studentProfile.personId,
      ),
      linkedChildStudentProfileIds: linkedChildren.map(
        (relationship) => relationship.studentProfileId,
      ),
      schools: [...schoolMap.values()].map((school) => ({
        id: school.id,
        name: school.name,
        campuses: [...school.campuses].map(([id, name]) => ({ id, name })),
      })),
    };
  }
}
