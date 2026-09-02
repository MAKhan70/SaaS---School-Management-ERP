import { describe, expect, it } from "vitest";

import {
  evaluatePermission,
  type PermissionGrant,
} from "@/modules/identity/authorization/permission-evaluator";

const grant: PermissionGrant = {
  trustId: "trust-a",
  schoolId: "school-a",
  campusId: "campus-a",
  scope: "CAMPUS",
  permissionKeys: ["assessments.marks.enter"],
  effectiveFrom: new Date("2026-04-01"),
  active: true,
};

describe("examination permissions", () => {
  it("keeps entry separate from approval, locking, and publishing", () => {
    for (const permissionKey of [
      "assessments.marks.approve",
      "assessments.marks.lock",
      "assessments.results.publish",
    ])
      expect(
        evaluatePermission(
          {
            actorUserId: "teacher",
            activeTrustId: "trust-a",
            permissionKey,
            resource: {
              trustId: "trust-a",
              schoolId: "school-a",
              campusId: "campus-a",
            },
          },
          [grant],
        ),
      ).toEqual({ allowed: false, reason: "PERMISSION_NOT_GRANTED" });
  });
});
