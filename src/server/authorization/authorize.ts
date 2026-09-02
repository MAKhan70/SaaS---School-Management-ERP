import {
  evaluatePermission,
  permissionKeySchema,
  type PermissionDecision,
} from "@/modules/identity/authorization/permission-evaluator";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";

export class AuthorizationError extends Error {
  constructor(readonly decision: PermissionDecision) {
    super("Access denied");
    this.name = "AuthorizationError";
  }
}

export function authorize(
  context: AuthenticatedContext,
  permissionKey: string,
  resource: {
    trustId: string;
    schoolId?: string;
    campusId?: string;
    ownerUserId?: string;
    personId?: string;
  },
): PermissionDecision {
  return evaluatePermission(
    {
      actorUserId: context.userId,
      activeTrustId: context.trustId,
      permissionKey: permissionKeySchema.parse(permissionKey),
      resource,
      linkedChildPersonIds: new Set(context.linkedChildPersonIds ?? []),
    },
    context.permissionGrants,
  );
}

export function requirePermission(
  context: AuthenticatedContext,
  permissionKey: string,
  resource: Parameters<typeof authorize>[2],
): void {
  const decision = authorize(context, permissionKey, resource);
  if (!decision.allowed) throw new AuthorizationError(decision);
}
