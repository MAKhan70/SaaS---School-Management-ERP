import { describe, expect, it } from "vitest";

import {
  duplicateFingerprint,
  normalizedContactHash,
  parseStudentCsv,
  studentMutationSchema,
} from "@/modules/students/domain/student-contracts";

describe("student contracts", () => {
  it("normalizes duplicate and contact comparisons without retaining the source value", () => {
    expect(
      duplicateFingerprint({
        firstName: " Aarav ",
        lastName: "JOSHI",
        dateOfBirth: "2013-08-12",
      }),
    ).toBe("aarav|joshi|2013-08-12");
    expect(normalizedContactHash("+91 90000-00001")).toBe(
      normalizedContactHash("+919000000001"),
    );
    expect(normalizedContactHash("+919000000001")).not.toContain("9000000001");
  });

  it("returns row-specific CSV errors and accepts a valid synthetic row", () => {
    const header =
      "firstName,lastName,dateOfBirth,admissionDate,academicYearId,campusId,sectionId,phone,email";
    const result = parseStudentCsv(
      `${header}\nAarav,Joshi,2013-08-12,2026-04-01,year,campus,section,+919000000001,guardian@example.test\nBad,Row,not-a-date,2026-04-01,year,campus,,,`,
    );
    expect(result.accepted).toHaveLength(1);
    expect(result.errors).toEqual([{ row: 3, message: expect.any(String) }]);
  });

  it("rejects malformed lifecycle mutations at the server boundary", () => {
    expect(
      studentMutationSchema.safeParse({
        action: "enrollment.promote",
        studentId: "s1",
      }).success,
    ).toBe(false);
  });
});
