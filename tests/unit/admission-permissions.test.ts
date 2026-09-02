import { authorize } from "@/server/authorization/authorize";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import { describe, expect, it } from "vitest";

const context: AuthenticatedContext = {
  sessionId: "admission-permission-test",
  userId: "counselor",
  displayName: "Synthetic Counselor",
  email: "counselor@example.test",
  trustId: "trust-a",
  trustName: "Trust A",
  schoolId: "school-a",
  academicYearId: "year-a",
  academicYearName: "2026-27",
  permissionKeys: ["admissions.crm.read"],
  permissionGrants: [
    {
      trustId: "trust-a",
      schoolId: "school-a",
      scope: "SCHOOL",
      permissionKeys: ["admissions.crm.read"],
      effectiveFrom: new Date("2026-01-01"),
      active: true,
    },
  ],
  schools: [],
};

describe("admissions permissions", () => {
  it("allows only the granted school and never infers mutation access", () => {
    expect(
      authorize(context, "admissions.crm.read", {
        trustId: "trust-a",
        schoolId: "school-a",
      }).allowed,
    ).toBe(true);
    expect(
      authorize(context, "admissions.crm.read", {
        trustId: "trust-a",
        schoolId: "school-b",
      }).allowed,
    ).toBe(false);
    expect(
      authorize(context, "admissions.application.convert", {
        trustId: "trust-a",
        schoolId: "school-a",
      }).allowed,
    ).toBe(false);
  });
});
