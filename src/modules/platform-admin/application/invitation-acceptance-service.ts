import { AuditOutcome, type PrismaClient } from "@/generated/prisma";
import type { RequestMetadata } from "@/modules/identity/domain/request-security";
import {
  hashOpaqueValue,
  hashPassword,
} from "@/modules/identity/infrastructure/credential-crypto";
import { invitationAcceptanceSchema } from "@/modules/platform-admin/domain/platform-admin-contracts";

export class InvitationAcceptanceService {
  constructor(private readonly database: PrismaClient) {}

  async accept(
    untrustedInput: unknown,
    metadata: RequestMetadata,
    now = new Date(),
  ) {
    const input = invitationAcceptanceSchema.parse(untrustedInput);
    const passwordHash = await hashPassword(input.password);
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${input.trustId}, true)`;
      const invitation = await transaction.staffInvitation.findUnique({
        where: { tokenHash: hashOpaqueValue(input.token) },
      });
      if (
        !invitation ||
        invitation.trustId !== input.trustId ||
        invitation.roleKey !== "trust_admin" ||
        invitation.status !== "PENDING" ||
        invitation.expiresAt <= now
      )
        throw new Error("Invitation unavailable");
      const user = await transaction.user.findUnique({
        where: { email: invitation.email },
      });
      if (!user || user.passwordHash) throw new Error("Invitation unavailable");
      await transaction.user.update({
        where: { id: user.id },
        data: { passwordHash, emailVerifiedAt: now, credentialsUpdatedAt: now },
      });
      await transaction.staffInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: now },
      });
      await transaction.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.auditEvent.create({
        data: {
          trustId: invitation.trustId,
          schoolId: invitation.schoolId,
          campusId: invitation.campusId,
          actorUserId: user.id,
          action: "identity.client_administrator.activated",
          resourceType: "User",
          resourceId: user.id,
          outcome: AuditOutcome.SUCCEEDED,
          sensitivity: "SENSITIVE",
          correlationId: metadata.correlationId,
        },
      });
      return true;
    });
  }
}
