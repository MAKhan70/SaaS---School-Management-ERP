import { type PrismaClient, RateLimitAction } from "@/generated/prisma";
import { hashOpaqueValue } from "@/modules/identity/infrastructure/credential-crypto";

export interface RateLimitPolicy {
  action: RateLimitAction;
  key: string;
  limit: number;
  windowMs: number;
  blockMs?: number;
}

export async function consumePersistentRateLimit(
  database: PrismaClient,
  policy: RateLimitPolicy,
  now = new Date(),
): Promise<boolean> {
  const keyHash = hashOpaqueValue(policy.key);
  const lockKey = `${policy.action}:${keyHash}`;

  return database.$transaction(async (transaction) => {
    // Serialize a bucket because read-modify-write under READ COMMITTED can lose attempts.
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS lock`;
    const existing = await transaction.authRateLimit.findUnique({
      where: { action_keyHash: { action: policy.action, keyHash } },
    });
    if (existing?.blockedUntil && existing.blockedUntil > now) return false;

    if (
      !existing ||
      now.getTime() - existing.windowStart.getTime() >= policy.windowMs
    ) {
      await transaction.authRateLimit.upsert({
        where: { action_keyHash: { action: policy.action, keyHash } },
        update: { windowStart: now, attemptCount: 1, blockedUntil: null },
        create: { action: policy.action, keyHash, windowStart: now },
      });
      return true;
    }

    const attemptCount = existing.attemptCount + 1;
    const allowed = attemptCount <= policy.limit;
    await transaction.authRateLimit.update({
      where: { id: existing.id },
      data: {
        attemptCount,
        blockedUntil: allowed
          ? null
          : new Date(now.getTime() + (policy.blockMs ?? policy.windowMs)),
      },
    });
    return allowed;
  });
}
