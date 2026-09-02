import { describe, expect, it } from "vitest";

import {
  evaluatePermission,
  type PermissionGrant,
  type PermissionKey,
} from "@/modules/identity/authorization/permission-evaluator";

const now = new Date("2026-09-01T00:00:00.000Z");
const permissionKey = "students.profile.read" as PermissionKey;

function grant(overrides: Partial<PermissionGrant> = {}): PermissionGrant {
  return {
    trustId: "trust-a",
    permissionKeys: [permissionKey],
    scope: "TRUST",
    effectiveFrom: new Date("2026-04-01T00:00:00.000Z"),
    active: true,
    ...overrides,
  };
}

describe("evaluatePermission", () => {
  it("allows an effective trust-wide permission", () => {
    const decision = evaluatePermission(
      {
        actorUserId: "user-a",
        activeTrustId: "trust-a",
        permissionKey,
        resource: { trustId: "trust-a", schoolId: "school-a" },
        now,
      },
      [grant()],
    );

    expect(decision).toEqual({ allowed: true, reason: "ALLOWED" });
  });

  it("denies access when the active trust differs from the resource trust", () => {
    const decision = evaluatePermission(
      {
        actorUserId: "user-a",
        activeTrustId: "trust-a",
        permissionKey,
        resource: { trustId: "trust-b", schoolId: "school-b" },
        now,
      },
      [grant()],
    );

    expect(decision).toEqual({
      allowed: false,
      reason: "ACTIVE_TRUST_MISMATCH",
    });
  });

  it("denies a school-scoped grant for a different school", () => {
    const decision = evaluatePermission(
      {
        actorUserId: "user-a",
        activeTrustId: "trust-a",
        permissionKey,
        resource: { trustId: "trust-a", schoolId: "school-b" },
        now,
      },
      [grant({ scope: "SCHOOL", schoolId: "school-a" })],
    );

    expect(decision).toEqual({
      allowed: false,
      reason: "RESOURCE_OUT_OF_SCOPE",
    });
  });

  it("denies expired grants", () => {
    const decision = evaluatePermission(
      {
        actorUserId: "user-a",
        activeTrustId: "trust-a",
        permissionKey,
        resource: { trustId: "trust-a" },
        now,
      },
      [grant({ effectiveTo: new Date("2026-08-31T23:59:59.000Z") })],
    );

    expect(decision).toEqual({ allowed: false, reason: "NO_ACTIVE_GRANT" });
  });

  it("allows a guardian to access only a linked child's person resource", () => {
    const decision = evaluatePermission(
      {
        actorUserId: "guardian-user",
        activeTrustId: "trust-a",
        permissionKey,
        resource: { trustId: "trust-a", personId: "student-person-a" },
        linkedChildPersonIds: new Set(["student-person-a"]),
        now,
      },
      [grant({ scope: "LINKED_CHILDREN" })],
    );

    expect(decision).toEqual({ allowed: true, reason: "ALLOWED" });
  });
});
