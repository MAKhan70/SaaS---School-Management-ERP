import { createHash, randomUUID } from "node:crypto";

import {
  AssignmentScope,
  AuditOutcome,
  type PrismaClient,
} from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import type { RequestMetadata } from "@/modules/identity/domain/request-security";
import {
  createOpaqueToken,
  hashOpaqueValue,
} from "@/modules/identity/infrastructure/credential-crypto";
import type { ClientInviteDelivery } from "@/modules/platform-admin/application/invite-delivery";
import { tenantFeatures } from "@/modules/platform-admin/domain/feature-catalogue";
import {
  clientProvisionSchema,
  featureUpdateSchema,
  supportAccessSchema,
  type ClientProvisionInput,
} from "@/modules/platform-admin/domain/platform-admin-contracts";

const PLATFORM_MANAGE = "platform.clients.manage";
const SUPPORT_ACCESS = "platform.support.access";

async function requirePlatformPermission(
  database: PrismaClient,
  userId: string,
  permissionKey: string,
  now = new Date(),
) {
  const assignment = await database.platformRoleAssignment.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      role: {
        trustId: null,
        status: "ACTIVE",
        rolePermissions: {
          some: { permission: { key: permissionKey, status: "ACTIVE" } },
        },
      },
    },
  });
  if (!assignment) throw new Error("Access denied");
}

function dateOnly(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export class PlatformAdminService {
  constructor(
    private readonly database: PrismaClient,
    private readonly delivery?: ClientInviteDelivery,
  ) {}

  async listClients(context: AuthenticatedContext) {
    await requirePlatformPermission(
      this.database,
      context.userId,
      PLATFORM_MANAGE,
    );
    const trusts = await this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
      return transaction.trust.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
        },
      });
    });
    const clients = [];
    for (const trust of trusts) {
      const details = await this.database.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trust.id}, true)`;
        const [schools, featureGrants, staffInvitations] = await Promise.all([
          transaction.school.findMany({
            where: { trustId: trust.id },
            select: {
              id: true,
              name: true,
              campuses: { select: { id: true, name: true } },
            },
          }),
          transaction.tenantFeatureGrant.findMany({
            where: { trustId: trust.id, enabled: true },
            select: { featureKey: true },
          }),
          transaction.staffInvitation.findMany({
            where: { trustId: trust.id, roleKey: "trust_admin" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              status: true,
              expiresAt: true,
            },
          }),
        ]);
        return { schools, featureGrants, staffInvitations };
      });
      clients.push({ ...trust, ...details });
    }
    return clients;
  }

  async provisionClient(
    context: AuthenticatedContext,
    untrustedInput: ClientProvisionInput,
    metadata: RequestMetadata,
    appOrigin: string,
    now = new Date(),
  ) {
    await requirePlatformPermission(
      this.database,
      context.userId,
      PLATFORM_MANAGE,
      now,
    );
    const input = clientProvisionSchema.parse(untrustedInput);
    const token = createOpaqueToken();
    const ids = {
      trustId: randomUUID(),
      schoolId: randomUUID(),
      campusId: randomUUID(),
      academicYearId: randomUUID(),
      administratorUserId: randomUUID(),
      invitationId: randomUUID(),
    };

    const result = await this.database.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
        await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${ids.trustId}, true)`;
        const platform = await transaction.platform.findUniqueOrThrow({
          where: { key: "nasaq" },
        });
        const role = await transaction.role.findFirstOrThrow({
          where: {
            platformId: platform.id,
            key: "trust_admin",
            trustId: null,
            status: "ACTIVE",
          },
        });
        const duplicate = await Promise.all([
          transaction.trust.findUnique({ where: { slug: input.trustSlug } }),
          transaction.user.findUnique({
            where: { email: input.administratorEmail },
          }),
        ]);
        if (duplicate.some(Boolean))
          throw new Error("Client or administrator already exists");

        await transaction.trust.create({
          data: {
            id: ids.trustId,
            platformId: platform.id,
            slug: input.trustSlug,
            name: input.trustName,
          },
        });
        await transaction.school.create({
          data: {
            id: ids.schoolId,
            trustId: ids.trustId,
            code: input.schoolCode,
            name: input.schoolName,
          },
        });
        await transaction.campus.create({
          data: {
            id: ids.campusId,
            trustId: ids.trustId,
            schoolId: ids.schoolId,
            code: input.campusCode,
            name: input.campusName,
          },
        });
        await transaction.academicYear.create({
          data: {
            id: ids.academicYearId,
            trustId: ids.trustId,
            schoolId: ids.schoolId,
            code: input.academicYearCode,
            name: input.academicYearName,
            startsOn: input.academicYearStartsOn,
            endsOn: input.academicYearEndsOn,
            status: "ACTIVE",
          },
        });
        await transaction.boardConfiguration.create({
          data: {
            trustId: ids.trustId,
            schoolId: ids.schoolId,
            boardType: input.boardType,
            stateCode: input.boardType === "MAHARASHTRA_STATE" ? "MH" : null,
            name:
              input.boardType === "MAHARASHTRA_STATE"
                ? "Maharashtra State Board"
                : input.boardType,
            version: 1,
            rules: { schemaVersion: 1, source: "platform-admin" },
            effectiveFrom: input.academicYearStartsOn,
            status: "ACTIVE",
          },
        });
        await transaction.user.create({
          data: {
            id: ids.administratorUserId,
            email: input.administratorEmail,
            profile: {
              create: {
                displayName: `${input.administratorFirstName} ${input.administratorLastName}`,
              },
            },
          },
        });
        await transaction.userTrustAccess.create({
          data: {
            userId: ids.administratorUserId,
            trustId: ids.trustId,
            effectiveFrom: dateOnly(now),
          },
        });
        const membership = await transaction.schoolMembership.create({
          data: {
            trustId: ids.trustId,
            userId: ids.administratorUserId,
            schoolId: ids.schoolId,
            status: "ACTIVE",
            effectiveFrom: dateOnly(now),
          },
        });
        const person = await transaction.person.create({
          data: {
            trustId: ids.trustId,
            userId: ids.administratorUserId,
            firstName: input.administratorFirstName,
            lastName: input.administratorLastName,
          },
        });
        await transaction.personContact.create({
          data: {
            trustId: ids.trustId,
            personId: person.id,
            type: "PHONE",
            value: input.administratorPhone,
            normalizedHash: createHash("sha256")
              .update(input.administratorPhone)
              .digest("base64url"),
            isPrimary: true,
          },
        });
        const staff = await transaction.staffProfile.create({
          data: {
            trustId: ids.trustId,
            personId: person.id,
            employeeCode: "ADMIN-001",
          },
        });
        await transaction.staffAssignment.create({
          data: {
            trustId: ids.trustId,
            staffProfileId: staff.id,
            schoolId: ids.schoolId,
            campusId: ids.campusId,
            title: "Trust Administrator",
            effectiveFrom: dateOnly(now),
          },
        });
        await transaction.userRoleAssignment.create({
          data: {
            trustId: ids.trustId,
            userId: ids.administratorUserId,
            roleId: role.id,
            schoolMembershipId: membership.id,
            scope: AssignmentScope.TRUST,
            effectiveFrom: dateOnly(now),
            createdBy: context.userId,
            updatedBy: context.userId,
          },
        });
        await transaction.staffInvitation.create({
          data: {
            id: ids.invitationId,
            trustId: ids.trustId,
            schoolId: ids.schoolId,
            campusId: ids.campusId,
            email: input.administratorEmail,
            firstName: input.administratorFirstName,
            lastName: input.administratorLastName,
            phone: input.administratorPhone,
            tokenHash: hashOpaqueValue(token),
            roleKey: "trust_admin",
            expiresAt: new Date(now.getTime() + 7 * 86_400_000),
            invitedBy: context.userId,
          },
        });
        await transaction.tenantFeatureGrant.createMany({
          data: input.featureKeys.map((featureKey) => ({
            platformId: platform.id,
            trustId: ids.trustId,
            featureKey,
            enabled: true,
            updatedBy: context.userId,
          })),
        });
        await transaction.tenantOnboarding.create({
          data: {
            trustId: ids.trustId,
            status: "COMPLETED",
            trustCreatedAt: now,
            schoolCreatedAt: now,
            campusCreatedAt: now,
            academicYearSetAt: now,
            boardSelectedAt: now,
            administratorSetAt: now,
            completedAt: now,
          },
        });
        await transaction.auditEvent.create({
          data: {
            trustId: ids.trustId,
            schoolId: ids.schoolId,
            campusId: ids.campusId,
            actorUserId: context.userId,
            action: "platform.client.provisioned",
            resourceType: "Trust",
            resourceId: ids.trustId,
            outcome: AuditOutcome.SUCCEEDED,
            correlationId: metadata.correlationId,
            metadata: {
              featureKeys: input.featureKeys,
              invitationId: ids.invitationId,
            },
          },
        });
        return ids;
      },
      { timeout: 20_000 },
    );

    const activationUrl = new URL(
      `/activate-account?trustId=${encodeURIComponent(ids.trustId)}&token=${encodeURIComponent(token)}`,
      appOrigin,
    ).toString();
    let deliveryStatus: "SENT" | "NOT_CONFIGURED" | "FAILED" = "NOT_CONFIGURED";
    try {
      deliveryStatus =
        (await this.delivery?.send({
          email: input.administratorEmail,
          firstName: input.administratorFirstName,
          trustName: input.trustName,
          activationUrl,
        })) ?? "NOT_CONFIGURED";
    } catch {
      deliveryStatus = "FAILED";
    }
    return { ...result, deliveryStatus };
  }

  async updateFeatures(
    context: AuthenticatedContext,
    trustId: string,
    raw: unknown,
    metadata: RequestMetadata,
  ) {
    await requirePlatformPermission(
      this.database,
      context.userId,
      PLATFORM_MANAGE,
    );
    const input = featureUpdateSchema.parse(raw);
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trustId}, true)`;
      const trust = await transaction.trust.findUniqueOrThrow({
        where: { id: trustId },
      });
      for (const feature of tenantFeatures) {
        await transaction.tenantFeatureGrant.upsert({
          where: { trustId_featureKey: { trustId, featureKey: feature.key } },
          update: {
            enabled: input.featureKeys.includes(feature.key),
            updatedBy: context.userId,
          },
          create: {
            platformId: trust.platformId,
            trustId,
            featureKey: feature.key,
            enabled: input.featureKeys.includes(feature.key),
            updatedBy: context.userId,
          },
        });
      }
      await transaction.auditEvent.create({
        data: {
          trustId,
          actorUserId: context.userId,
          action: "platform.client.features_updated",
          resourceType: "Trust",
          resourceId: trustId,
          outcome: "SUCCEEDED",
          correlationId: metadata.correlationId,
          changes: { enabledFeatureKeys: input.featureKeys },
        },
      });
      return input;
    });
  }

  async beginSupportAccess(
    context: AuthenticatedContext,
    trustId: string,
    raw: unknown,
    metadata: RequestMetadata,
    now = new Date(),
  ) {
    await requirePlatformPermission(
      this.database,
      context.userId,
      SUPPORT_ACCESS,
      now,
    );
    const input = supportAccessSchema.parse(raw);
    const expiresAt = new Date(now.getTime() + input.durationMinutes * 60_000);
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${trustId}, true)`;
      const school = await transaction.school.findFirstOrThrow({
        where: { trustId, status: "ACTIVE" },
        include: { campuses: { where: { status: "ACTIVE" }, take: 1 } },
      });
      const year = await transaction.academicYear.findFirstOrThrow({
        where: {
          trustId,
          status: "ACTIVE",
          OR: [{ schoolId: school.id }, { schoolId: null }],
        },
      });
      const role = await transaction.role.findFirstOrThrow({
        where: { key: "trust_admin", trustId: null, status: "ACTIVE" },
      });
      const existingAccess = await transaction.userTrustAccess.findUnique({
        where: { userId_trustId: { userId: context.userId, trustId } },
      });
      if (!existingAccess)
        await transaction.userTrustAccess.create({
          data: {
            userId: context.userId,
            trustId,
            effectiveFrom: dateOnly(now),
            effectiveTo: dateOnly(now),
          },
        });
      let membership = await transaction.schoolMembership.findFirst({
        where: { trustId, userId: context.userId, schoolId: school.id },
      });
      membership ??= await transaction.schoolMembership.create({
        data: {
          trustId,
          userId: context.userId,
          schoolId: school.id,
          status: "ACTIVE",
          effectiveFrom: dateOnly(now),
          effectiveTo: dateOnly(now),
        },
      });
      const grant = await transaction.supportAccessGrant.create({
        data: {
          trustId,
          actorUserId: context.userId,
          reason: input.reason,
          expiresAt,
        },
      });
      await transaction.userRoleAssignment.create({
        data: {
          trustId,
          userId: context.userId,
          roleId: role.id,
          schoolMembershipId: membership.id,
          supportAccessGrantId: grant.id,
          scope: "TRUST",
          effectiveFrom: dateOnly(now),
          effectiveTo: dateOnly(now),
          createdBy: context.userId,
          updatedBy: context.userId,
        },
      });
      await transaction.session.update({
        where: { id: context.sessionId },
        data: {
          activeTrustId: trustId,
          activeSchoolId: school.id,
          activeCampusId: school.campuses[0]?.id,
          activeAcademicYearId: year.id,
          rotatedAt: now,
        },
      });
      await transaction.auditEvent.create({
        data: {
          trustId,
          schoolId: school.id,
          campusId: school.campuses[0]?.id,
          actorUserId: context.userId,
          effectiveActorUserId: context.userId,
          action: "platform.support_access.started",
          resourceType: "SupportAccessGrant",
          resourceId: grant.id,
          outcome: "SUCCEEDED",
          sensitivity: "RESTRICTED",
          correlationId: metadata.correlationId,
          reasonCode: "PLATFORM_SUPPORT",
          metadata: { expiresAt: expiresAt.toISOString() },
        },
      });
      return { expiresAt };
    });
  }
}
