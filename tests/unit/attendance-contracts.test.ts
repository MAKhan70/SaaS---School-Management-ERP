import {
  attendanceMutationSchema,
  calculateAttendancePercentage,
  consecutiveAbsenceCount,
  isPreviousDay,
} from "@/modules/attendance/domain/attendance-contracts";
import { UnsupportedFacialRecognitionError } from "@/modules/attendance/application/device-adapter";
import { describe, expect, it } from "vitest";

describe("attendance domain contracts", () => {
  it("validates bounded bulk submissions and rejects malformed status rows", () => {
    const valid = {
      action: "student.bulk.submit",
      sectionId: "section-a",
      date: "2026-09-01",
      clientSubmissionId: crypto.randomUUID(),
      records: [
        {
          enrollmentId: "enrollment-a",
          studentProfileId: "student-a",
          statusCode: "PRESENT",
        },
      ],
    };
    expect(attendanceMutationSchema.safeParse(valid).success).toBe(true);
    expect(
      attendanceMutationSchema.safeParse({ ...valid, records: [] }).success,
    ).toBe(false);
    expect(
      attendanceMutationSchema.safeParse({
        ...valid,
        records: [{ ...valid.records[0], minutesLate: -1 }],
      }).success,
    ).toBe(false);
  });

  it("calculates fractional monthly attendance without rounding drift", () => {
    expect(calculateAttendancePercentage([100, 100, 50, 0])).toBe(62.5);
    expect(calculateAttendancePercentage([])).toBe(0);
  });

  it("finds consecutive absences and detects previous-day corrections", () => {
    expect(
      consecutiveAbsenceCount([
        "ABSENT",
        "ABSENT",
        "PRESENT",
        "ABSENT",
        "ABSENT",
        "ABSENT",
      ]),
    ).toBe(3);
    expect(isPreviousDay("2026-08-31", new Date("2026-09-01T10:00:00Z"))).toBe(
      true,
    );
  });

  it("rejects facial recognition as an attendance device event source", () => {
    expect(
      attendanceMutationSchema.safeParse({
        action: "staff.check",
        staffProfileId: "staff-a",
        date: "2026-09-01",
        source: "FACIAL_RECOGNITION",
      }).success,
    ).toBe(false);
    expect(new UnsupportedFacialRecognitionError().message).toMatch(
      /not supported/,
    );
  });
});
