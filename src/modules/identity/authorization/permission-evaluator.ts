import { z } from "zod";

export const permissionKeySchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}$/,
    "Permission keys must use domain.resource.action segments",
  );

export type PermissionKey = z.infer<typeof permissionKeySchema>;

export type PermissionScope =
  "TRUST" | "SCHOOL" | "CAMPUS" | "SELF" | "LINKED_CHILDREN";

export interface PermissionGrant {
  trustId: string;
  permissionKeys: readonly PermissionKey[];
  scope: PermissionScope;
  schoolId?: string;
  campusId?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  active: boolean;
}

export interface PermissionRequest {
  actorUserId: string;
  activeTrustId: string;
  permissionKey: PermissionKey;
  resource: {
    trustId: string;
    schoolId?: string;
    campusId?: string;
    ownerUserId?: string;
    personId?: string;
  };
  linkedChildPersonIds?: ReadonlySet<string>;
  now?: Date;
}

export type PermissionDecisionReason =
  | "ALLOWED"
  | "ACTIVE_TRUST_MISMATCH"
  | "NO_ACTIVE_GRANT"
  | "PERMISSION_NOT_GRANTED"
  | "RESOURCE_OUT_OF_SCOPE";

export interface PermissionDecision {
  allowed: boolean;
  reason: PermissionDecisionReason;
}

function isEffective(grant: PermissionGrant, now: Date): boolean {
  return (
    grant.active &&
    grant.effectiveFrom <= now &&
    (!grant.effectiveTo || grant.effectiveTo >= now)
  );
}

function coversResource(
  grant: PermissionGrant,
  request: PermissionRequest,
): boolean {
  const { resource } = request;

  switch (grant.scope) {
    case "TRUST":
      return true;
    case "SCHOOL":
      return Boolean(grant.schoolId && resource.schoolId === grant.schoolId);
    case "CAMPUS":
      return Boolean(
        grant.schoolId &&
        grant.campusId &&
        resource.schoolId === grant.schoolId &&
        resource.campusId === grant.campusId,
      );
    case "SELF":
      return resource.ownerUserId === request.actorUserId;
    case "LINKED_CHILDREN":
      return Boolean(
        resource.personId &&
        request.linkedChildPersonIds?.has(resource.personId),
      );
  }
}

export function evaluatePermission(
  request: PermissionRequest,
  grants: readonly PermissionGrant[],
): PermissionDecision {
  permissionKeySchema.parse(request.permissionKey);

  if (request.activeTrustId !== request.resource.trustId) {
    return { allowed: false, reason: "ACTIVE_TRUST_MISMATCH" };
  }

  const now = request.now ?? new Date();
  const activeTenantGrants = grants.filter(
    (grant) =>
      grant.trustId === request.activeTrustId && isEffective(grant, now),
  );

  if (activeTenantGrants.length === 0) {
    return { allowed: false, reason: "NO_ACTIVE_GRANT" };
  }

  const permissionGrants = activeTenantGrants.filter((grant) =>
    grant.permissionKeys.includes(request.permissionKey),
  );

  if (permissionGrants.length === 0) {
    return { allowed: false, reason: "PERMISSION_NOT_GRANTED" };
  }

  if (!permissionGrants.some((grant) => coversResource(grant, request))) {
    return { allowed: false, reason: "RESOURCE_OUT_OF_SCOPE" };
  }

  return { allowed: true, reason: "ALLOWED" };
}
