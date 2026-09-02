import { describe, expect, it } from "vitest";

import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import { authorize } from "@/server/authorization/authorize";

const context: AuthenticatedContext = {
  sessionId: "session-student-test",
  userId: "user-test",
  displayName: "Synthetic Administrator",
  email: "admin@example.test",
  trustId: "trust-a",
  trustName: "Trust A",
  schoolId: "school-a",
  academicYearId: "year-a",
  academicYearName: "2026–27",
  schools: [],
  permissionKeys: ["students.profile.read", "students.documents.read"],
  permissionGrants: [
    {
      trustId: "trust-a",
      schoolId: "school-a",
      scope: "SCHOOL",
      permissionKeys: ["students.profile.read", "students.documents.read"],
      effectiveFrom: new Date("2026-04-01"),
      active: true,
    },
  ],
};

describe("student permission separation", () => {
  it("allows profile read but does not imply sensitive or export access", () => {
    expect(
      authorize(context, "students.profile.read", {
        trustId: "trust-a",
        schoolId: "school-a",
      }).allowed,
    ).toBe(true);
    expect(
      authorize(context, "students.sensitive.read", {
        trustId: "trust-a",
        schoolId: "school-a",
      }).allowed,
    ).toBe(false);
    expect(
      authorize(context, "students.data.export", {
        trustId: "trust-a",
        schoolId: "school-a",
      }).allowed,
    ).toBe(false);
  });

  it("denies a document in another school even with the document permission", () => {
    expect(
      authorize(context, "students.documents.read", {
        trustId: "trust-a",
        schoolId: "school-b",
      }).allowed,
    ).toBe(false);
  });
});
