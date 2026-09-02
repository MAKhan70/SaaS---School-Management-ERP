import {
  admissionFormDefinitionSchema,
  canTransitionAdmission,
  createPublicFormToken,
  publicAdmissionSubmissionSchema,
  verifyPublicFormToken,
} from "@/modules/admissions/domain/admission-contracts";
import { describe, expect, it } from "vitest";

describe("admissions domain contracts", () => {
  it("allows the reviewed offer path and rejects skipped or terminal transitions", () => {
    expect(canTransitionAdmission("UNDER_REVIEW", "OFFERED")).toBe(true);
    expect(canTransitionAdmission("ENQUIRY", "ADMITTED")).toBe(false);
    expect(canTransitionAdmission("REJECTED", "UNDER_REVIEW")).toBe(false);
  });

  it("validates configurable fields and prevents duplicate field keys", () => {
    expect(
      admissionFormDefinitionSchema.safeParse({
        fields: [
          {
            key: "parentName",
            label: "Parent name",
            type: "text",
            required: true,
          },
          {
            key: "parentName",
            label: "Guardian name",
            type: "text",
            required: false,
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      admissionFormDefinitionSchema.safeParse({
        fields: [
          { key: "board", label: "Board", type: "select", required: true },
        ],
      }).success,
    ).toBe(false);
  });

  it("signs time-limited public form tokens without exposing state", () => {
    const issuedAt = new Date("2026-09-01T10:00:00.000Z");
    const token = createPublicFormToken("public-form", issuedAt);
    expect(
      verifyPublicFormToken(
        "public-form",
        token,
        new Date("2026-09-01T10:00:02.000Z"),
      ),
    ).toBe(true);
    expect(
      verifyPublicFormToken(
        "another-form",
        token,
        new Date("2026-09-01T10:00:02.000Z"),
      ),
    ).toBe(false);
    expect(
      verifyPublicFormToken(
        "public-form",
        token,
        new Date("2026-09-01T12:01:00.000Z"),
      ),
    ).toBe(false);
  });

  it("requires one valid contact method and rejects a populated honeypot", () => {
    const valid = {
      formToken: "x".repeat(30),
      website: "",
      applicantName: "Synthetic Applicant",
      phone: "+919876543210",
      source: "SCHOOL_WEBSITE",
      answers: {},
    };
    expect(publicAdmissionSubmissionSchema.safeParse(valid).success).toBe(true);
    expect(
      publicAdmissionSubmissionSchema.safeParse({ ...valid, phone: undefined })
        .success,
    ).toBe(false);
    expect(
      publicAdmissionSubmissionSchema.safeParse({
        ...valid,
        website: "spam.example",
      }).success,
    ).toBe(false);
  });
});
