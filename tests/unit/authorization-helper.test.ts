import { describe, expect, it } from "vitest";

import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import {
  AuthorizationError,
  requirePermission,
} from "@/server/authorization/authorize";

const context: AuthenticatedContext = {
  sessionId: "session-a",
  userId: "user-a",
  displayName: "Fictional Admin",
  email: "admin@example.test",
  trustId: "trust-a",
  trustName: "Trust A",
  schoolId: "school-a",
  academicYearId: "year-a",
  academicYearName: "2026–27",
  permissionKeys: ["institutions.school.manage"],
  schools: [],
  permissionGrants: [
    {
      trustId: "trust-a",
      permissionKeys: ["institutions.school.manage"],
      scope: "SCHOOL",
      schoolId: "school-a",
      effectiveFrom: new Date("2026-04-01"),
      active: true,
    },
  ],
};

describe("requirePermission", () => {
  it("allows the assigned permission within school scope", () => {
    expect(() =>
      requirePermission(context, "institutions.school.manage", {
        trustId: "trust-a",
        schoolId: "school-a",
      }),
    ).not.toThrow();
  });

  it("denies another school and another trust", () => {
    expect(() =>
      requirePermission(context, "institutions.school.manage", {
        trustId: "trust-a",
        schoolId: "school-b",
      }),
    ).toThrow(AuthorizationError);
    expect(() =>
      requirePermission(context, "institutions.school.manage", {
        trustId: "trust-b",
        schoolId: "school-a",
      }),
    ).toThrow(AuthorizationError);
  });
});
