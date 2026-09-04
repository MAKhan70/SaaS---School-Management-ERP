import { RecordStatus, type PrismaClient } from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import { authorize, requirePermission } from "@/server/authorization/authorize";
import { withTenant } from "@/server/database/tenant-context";

export class InstitutionService {
  constructor(private readonly client: PrismaClient) {}

  async overview(context: AuthenticatedContext) {
    const resource = {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    };
    requirePermission(context, "institutions.school.manage", resource);

    const canManageTrust = authorize(context, "institutions.trust.manage", {
      trustId: context.trustId,
    }).allowed;
    const canManageSchool = authorize(context, "institutions.school.manage", {
      trustId: context.trustId,
      schoolId: context.schoolId,
    }).allowed;

    return withTenant(
      this.client,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: crypto.randomUUID(),
      },
      async (transaction) => {
        const [trust, school] = await Promise.all([
          transaction.trust.findFirstOrThrow({
            where: { id: context.trustId, status: RecordStatus.ACTIVE },
            select: {
              id: true,
              name: true,
              defaultLocale: true,
              defaultTimezone: true,
              defaultCurrency: true,
              status: true,
            },
          }),
          transaction.school.findFirstOrThrow({
            where: {
              id: context.schoolId,
              trustId: context.trustId,
              status: RecordStatus.ACTIVE,
            },
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              campuses: {
                where: {
                  status: RecordStatus.ACTIVE,
                  ...(context.campusId ? { id: context.campusId } : {}),
                },
                select: {
                  id: true,
                  code: true,
                  name: true,
                  timezone: true,
                  status: true,
                },
                orderBy: { name: "asc" },
              },
            },
          }),
        ]);

        return { trust, school, canManageTrust, canManageSchool };
      },
    );
  }
}
