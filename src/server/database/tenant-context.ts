import type { Prisma, PrismaClient } from "@/generated/prisma";
import { z } from "zod";

export const tenantContextSchema = z.object({
  trustId: z.string().min(1),
  actorUserId: z.string().min(1).optional(),
  correlationId: z.string().min(1),
});

export type TenantContext = z.infer<typeof tenantContextSchema>;

type TransactionOperation<TResult> = (
  transaction: Prisma.TransactionClient,
) => Promise<TResult>;

export async function withTenant<TResult>(
  client: PrismaClient,
  context: TenantContext,
  operation: TransactionOperation<TResult>,
): Promise<TResult> {
  const verifiedContext = tenantContextSchema.parse(context);

  return client.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${verifiedContext.trustId}, true)`;
    return operation(transaction);
  });
}
