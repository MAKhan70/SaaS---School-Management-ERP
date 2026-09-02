import { randomUUID } from "node:crypto";

import {
  AssignmentScope,
  AuditOutcome,
  BoardConfigurationStatus,
  MembershipStatus,
  OnboardingStatus,
  RateLimitAction,
  type PrismaClient,
} from "@/generated/prisma";
import type { RequestMetadata } from "@/modules/identity/domain/request-security";
import {
  createOpaqueToken,
  hashOpaqueValue,
  hashPassword,
} from "@/modules/identity/infrastructure/credential-crypto";
import {
  tenantOnboardingSchema,
  type TenantOnboardingInput,
} from "@/modules/onboarding/domain/onboarding-contracts";
import { consumePersistentRateLimit } from "@/server/security/persistent-rate-limit";
import { tenantFeatures } from "@/modules/platform-admin/domain/feature-catalogue";

export interface OnboardingResult {
  trustId: string;
  schoolId: string;
  campusId: string;
  administratorUserId: string;
}

export class OnboardingConflictError extends Error {
  constructor() {
    super("An organization or account with these details already exists");
    this.name = "OnboardingConflictError";
  }
}

export class TenantOnboardingService {
  constructor(private readonly database: PrismaClient) {}

  async complete(
    untrustedInput: TenantOnboardingInput,
    metadata: RequestMetadata,
    now = new Date(),
  ): Promise<OnboardingResult> {
    const input = tenantOnboardingSchema.parse(untrustedInput);
    const allowed = await consumePersistentRateLimit(
      this.database,
      {
        action: RateLimitAction.TENANT_ONBOARDING,
        key: `${metadata.ipHash ?? "unknown"}:${input.administratorEmail}`,
        limit: 3,
        windowMs: 60 * 60 * 1000,
        blockMs: 60 * 60 * 1000,
      },
      now,
    );
    if (!allowed) throw new Error("Onboarding rate limit exceeded");
    const duplicate = await this.database.$transaction(async (transaction) => {
      const [trust, user] = await Promise.all([
        transaction.trust.findUnique({ where: { slug: input.trustSlug } }),
        transaction.user.findUnique({
          where: { email: input.administratorEmail },
        }),
      ]);
      return Boolean(trust || user);
    });
    if (duplicate) throw new OnboardingConflictError();

    const passwordHash = await hashPassword(input.administratorPassword);
    const trustId = randomUUID();
    const schoolId = randomUUID();
    const campusId = randomUUID();
    const academicYearId = randomUUID();
    const administratorUserId = randomUUID();

    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trustId}, true)`;
      const platform = await transaction.platform.findUniqueOrThrow({
        where: { key: "nasaq" },
      });
      const trustAdminRole = await transaction.role.findFirstOrThrow({
        where: {
          platformId: platform.id,
          key: "trust_admin",
          origin: "SYSTEM",
          status: "ACTIVE",
        },
      });
      await transaction.trust.create({
        data: {
          id: trustId,
          platformId: platform.id,
          slug: input.trustSlug,
          name: input.trustName,
        },
      });
      await transaction.school.create({
        data: {
          id: schoolId,
          trustId,
          code: input.schoolCode,
          name: input.schoolName,
        },
      });
      await transaction.campus.create({
        data: {
          id: campusId,
          trustId,
          schoolId,
          code: input.campusCode,
          name: input.campusName,
        },
      });
      await transaction.academicYear.create({
        data: {
          id: academicYearId,
          trustId,
          schoolId,
          code: input.academicYearCode,
          name: input.academicYearName,
          startsOn: input.academicYearStartsOn,
          endsOn: input.academicYearEndsOn,
          status: "ACTIVE",
        },
      });
      await transaction.numberingRule.create({
        data: {
          trustId,
          schoolId,
          academicYearId,
          entityType: "STUDENT",
          prefixTemplate: "{SCHOOL}-{YEAR}-S-",
          padding: 5,
          resetPolicy: "ACADEMIC_YEAR",
          version: 1,
          effectiveFrom: input.academicYearStartsOn,
        },
      });
      await transaction.boardConfiguration.create({
        data: {
          trustId,
          schoolId,
          boardType: input.boardType,
          stateCode: input.boardType === "MAHARASHTRA_STATE" ? "MH" : null,
          name:
            input.boardType === "MAHARASHTRA_STATE"
              ? "Maharashtra State Board"
              : input.boardType,
          version: 1,
          rules: { schemaVersion: 1, source: "tenant-onboarding" },
          effectiveFrom: input.academicYearStartsOn,
          status: BoardConfigurationStatus.ACTIVE,
        },
      });
      await transaction.user.create({
        data: {
          id: administratorUserId,
          email: input.administratorEmail,
          passwordHash,
          profile: { create: { displayName: input.administratorName } },
        },
      });
      await transaction.userTrustAccess.create({
        data: {
          userId: administratorUserId,
          trustId,
          status: MembershipStatus.ACTIVE,
          effectiveFrom: input.academicYearStartsOn,
        },
      });
      await transaction.schoolMembership.create({
        data: {
          trustId,
          userId: administratorUserId,
          schoolId,
          campusId: null,
          status: MembershipStatus.ACTIVE,
          effectiveFrom: input.academicYearStartsOn,
        },
      });
      const person = await transaction.person.create({
        data: {
          trustId,
          userId: administratorUserId,
          firstName: input.administratorName,
          lastName: "Administrator",
        },
      });
      const staff = await transaction.staffProfile.create({
        data: { trustId, personId: person.id, employeeCode: "ADMIN-001" },
      });
      await transaction.staffAssignment.create({
        data: {
          trustId,
          staffProfileId: staff.id,
          schoolId,
          campusId,
          title: "Trust Administrator",
          effectiveFrom: input.academicYearStartsOn,
        },
      });
      await transaction.userRoleAssignment.create({
        data: {
          trustId,
          userId: administratorUserId,
          roleId: trustAdminRole.id,
          scope: AssignmentScope.TRUST,
          effectiveFrom: input.academicYearStartsOn,
          createdBy: administratorUserId,
          updatedBy: administratorUserId,
        },
      });
      await transaction.tenantFeatureGrant.createMany({
        data: tenantFeatures.map((feature) => ({
          platformId: platform.id,
          trustId,
          featureKey: feature.key,
          enabled: true,
          updatedBy: administratorUserId,
        })),
      });

      for (const email of [...new Set(input.staffEmails)].filter(
        (value) => value !== input.administratorEmail,
      )) {
        await transaction.staffInvitation.create({
          data: {
            trustId,
            schoolId,
            campusId,
            email,
            tokenHash: hashOpaqueValue(createOpaqueToken()),
            roleKey: "teacher",
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            invitedBy: administratorUserId,
          },
        });
      }

      await transaction.tenantOnboarding.create({
        data: {
          trustId,
          status: OnboardingStatus.COMPLETED,
          trustCreatedAt: now,
          schoolCreatedAt: now,
          campusCreatedAt: now,
          academicYearSetAt: now,
          boardSelectedAt: now,
          administratorSetAt: now,
          initialStaffInvitedAt: input.staffEmails.length ? now : null,
          completedAt: now,
        },
      });
      await transaction.auditEvent.create({
        data: {
          trustId,
          schoolId,
          campusId,
          actorUserId: administratorUserId,
          action: "tenant.onboarding.completed",
          resourceType: "Trust",
          resourceId: trustId,
          outcome: AuditOutcome.SUCCEEDED,
          correlationId: metadata.correlationId,
          metadata: { invitedStaffCount: input.staffEmails.length },
        },
      });
      return { trustId, schoolId, campusId, administratorUserId };
    });
  }
}
