import { describe, expect, it } from "vitest";

import {
  evaluatePermission,
  type PermissionGrant,
  type PermissionKey,
} from "@/modules/identity/authorization/permission-evaluator";

const permission = "inventory.item.manage" as PermissionKey;
const grant: PermissionGrant = {
  trustId: "trust-a",
  schoolId: "school-a",
  scope: "SCHOOL",
  permissionKeys: [permission],
  effectiveFrom: new Date("2026-04-01T00:00:00.000Z"),
  active: true,
};

describe("operational permission scope", () => {
  it("allows the granted school and denies another school", () => {
    const base = {
      actorUserId: "user-a",
      activeTrustId: "trust-a",
      permissionKey: permission,
      now: new Date("2026-09-03T00:00:00.000Z"),
    };
    expect(
      evaluatePermission(
        { ...base, resource: { trustId: "trust-a", schoolId: "school-a" } },
        [grant],
      ).allowed,
    ).toBe(true);
    expect(
      evaluatePermission(
        { ...base, resource: { trustId: "trust-a", schoolId: "school-b" } },
        [grant],
      ).allowed,
    ).toBe(false);
  });

  it("denies an operational resource in another trust", () => {
    expect(
      evaluatePermission(
        {
          actorUserId: "user-a",
          activeTrustId: "trust-a",
          permissionKey: permission,
          resource: { trustId: "trust-b", schoolId: "school-b" },
          now: new Date("2026-09-03T00:00:00.000Z"),
        },
        [grant],
      ),
    ).toEqual({ allowed: false, reason: "ACTIVE_TRUST_MISMATCH" });
  });
});
