import { describe, expect, it } from "vitest";

import {
  dashboardQuerySchema,
  resolveDashboardPortal,
} from "@/modules/dashboards/domain/dashboard-contracts";
import {
  evaluatePermission,
  type PermissionGrant,
  type PermissionKey,
} from "@/modules/identity/authorization/permission-evaluator";

describe("dashboard permission selection", () => {
  it("uses stable permission keys and deterministic privilege priority", () => {
    expect(resolveDashboardPortal(["dashboard.teacher.read"])).toBe("TEACHER");
    expect(
      resolveDashboardPortal([
        "dashboard.accountant.read",
        "dashboard.principal.read",
      ]),
    ).toBe("PRINCIPAL");
    expect(resolveDashboardPortal(["platform.dashboard.read"])).toBeNull();
  });

  it("rejects malformed dates and empty resource identifiers", () => {
    expect(() => dashboardQuerySchema.parse({ date: "02/09/2026" })).toThrow();
    expect(() => dashboardQuerySchema.parse({ schoolId: "" })).toThrow();
  });

  it("does not allow a school dashboard grant across trusts", () => {
    const key = "dashboard.admin.read" as PermissionKey;
    const grants: PermissionGrant[] = [
      {
        trustId: "trust-a",
        schoolId: "school-a",
        scope: "SCHOOL",
        permissionKeys: [key],
        effectiveFrom: new Date("2026-04-01T00:00:00.000Z"),
        active: true,
      },
    ];
    expect(
      evaluatePermission(
        {
          actorUserId: "administrator-a",
          activeTrustId: "trust-a",
          permissionKey: key,
          resource: { trustId: "trust-b", schoolId: "school-b" },
          now: new Date("2026-09-02T00:00:00.000Z"),
        },
        grants,
      ),
    ).toEqual({ allowed: false, reason: "ACTIVE_TRUST_MISMATCH" });
  });

  it("allows only the selected linked child's parent portal resource", () => {
    const key = "dashboard.parent.read" as PermissionKey;
    const grants: PermissionGrant[] = [
      {
        trustId: "trust-a",
        scope: "LINKED_CHILDREN",
        permissionKeys: [key],
        effectiveFrom: new Date("2026-04-01T00:00:00.000Z"),
        active: true,
      },
    ];
    const base = {
      actorUserId: "parent-a",
      activeTrustId: "trust-a",
      permissionKey: key,
      linkedChildPersonIds: new Set(["child-a"]),
      now: new Date("2026-09-02T00:00:00.000Z"),
    };
    expect(
      evaluatePermission(
        { ...base, resource: { trustId: "trust-a", personId: "child-a" } },
        grants,
      ).allowed,
    ).toBe(true);
    expect(
      evaluatePermission(
        { ...base, resource: { trustId: "trust-a", personId: "child-b" } },
        grants,
      ).allowed,
    ).toBe(false);
  });
});
