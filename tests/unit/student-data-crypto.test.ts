import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  decryptStudentData,
  encryptStudentData,
  maskIdentifier,
} from "@/modules/students/infrastructure/student-data-crypto";

describe("restricted student data encryption", () => {
  it("round-trips with authenticated tenant scope and rejects a different scope", () => {
    const key = randomBytes(32);
    const scope = {
      trustId: "trust-a",
      studentId: "student-a",
      type: "ALLERGY",
    };
    const encrypted = encryptStudentData(
      { alert: "Synthetic allergy" },
      scope,
      key,
    );
    expect(decryptStudentData(encrypted, scope, key)).toEqual({
      alert: "Synthetic allergy",
    });
    expect(() =>
      decryptStudentData(encrypted, { ...scope, trustId: "trust-b" }, key),
    ).toThrow();
  });

  it("returns only a masked identifier", () => {
    expect(maskIdentifier("1234")).toBe("•••• 1234");
  });
});
