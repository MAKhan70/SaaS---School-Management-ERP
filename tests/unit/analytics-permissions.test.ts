import { describe, expect, it } from "vitest";

import {
  evaluatePermission,
  type PermissionGrant,
  type PermissionKey,
} from "@/modules/identity/authorization/permission-evaluator";

const read = "analytics.dashboard.read" as PermissionKey;
const exportPermission = "analytics.data.export" as PermissionKey;
const grant: PermissionGrant = {
  trustId: "trust-a",
  schoolId: "school-a",
  scope: "SCHOOL",
  permissionKeys: [read],
  effectiveFrom: new Date("2026-04-01T00:00:00.000Z"),
  active: true,
};

describe("analytics permissions", () => {
  it("does not imply export from dashboard read", () => {
    const base = {
      actorUserId: "user-a",
      activeTrustId: "trust-a",
      resource: { trustId: "trust-a", schoolId: "school-a" },
      now: new Date("2026-09-02T00:00:00.000Z"),
    };
    expect(
      evaluatePermission({ ...base, permissionKey: read }, [grant]).allowed,
    ).toBe(true);
    expect(
      evaluatePermission({ ...base, permissionKey: exportPermission }, [grant])
        .allowed,
    ).toBe(false);
  });

  it("denies a cross-trust analytics resource", () => {
    expect(
      evaluatePermission(
        {
          actorUserId: "user-a",
          activeTrustId: "trust-a",
          permissionKey: read,
          resource: { trustId: "trust-b", schoolId: "school-b" },
          now: new Date("2026-09-02T00:00:00.000Z"),
        },
        [grant],
      ),
    ).toEqual({ allowed: false, reason: "ACTIVE_TRUST_MISMATCH" });
  });
});
