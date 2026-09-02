import type { PrismaClient, School } from "@/generated/prisma";

import {
  type TenantContext,
  withTenant,
} from "@/server/database/tenant-context";

export class SchoolRepository {
  constructor(private readonly client: PrismaClient) {}

  async list(context: TenantContext): Promise<School[]> {
    return withTenant(this.client, context, (transaction) =>
      transaction.school.findMany({
        where: { trustId: context.trustId },
        orderBy: { code: "asc" },
      }),
    );
  }

  async findById(
    context: TenantContext,
    schoolId: string,
  ): Promise<School | null> {
    return withTenant(this.client, context, (transaction) =>
      transaction.school.findFirst({
        where: { id: schoolId, trustId: context.trustId },
      }),
    );
  }
}
