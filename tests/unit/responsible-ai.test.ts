import { describe, expect, it } from "vitest";

import {
  aiDraftRequestSchema,
  assertDraftIsAdvisory,
} from "@/modules/ai-assistance/domain/ai-contracts";
import {
  deterministicFallback,
  LocalMockAiProvider,
} from "@/modules/ai-assistance/application/ai-provider";
import {
  attendanceReviewRule,
  identifyAttendanceReviewCandidates,
} from "@/modules/ai-assistance/domain/support-indicator-policy";

describe("responsible assistance", () => {
  it("rejects personal and sensitive provider context", () => {
    expect(() =>
      aiDraftRequestSchema.parse({
        action: "CREATE_DRAFT",
        feature: "LESSON_PLAN_OUTLINE",
        context: { studentName: "Synthetic Learner", medicalDetails: "none" },
      }),
    ).toThrow(/personal or sensitive/i);
  });

  it("provides a deterministic non-AI fallback and marks local output as draft", async () => {
    const context = { topic: "Fractions", objective: "Compare fractions" };
    expect(deterministicFallback("LESSON_PLAN_OUTLINE", context)).toContain(
      "Draft for teacher review",
    );
    await expect(
      new LocalMockAiProvider().generate("LESSON_PLAN_OUTLINE", context),
    ).resolves.toContain("requires an authorised human reviewer");
  });

  it("blocks assistance text that attempts a prohibited autonomous decision", () => {
    expect(() =>
      assertDraftIsAdvisory("Admit this student immediately."),
    ).toThrow(/prohibited decision/i);
  });

  it("creates explainable review candidates without sensitive attributes", () => {
    const candidates = identifyAttendanceReviewCandidates([
      {
        studentProfileId: "student-a",
        campusId: "campus-a",
        totalRecords: 8,
        presentFractionTotal: 58_000,
      },
      {
        studentProfileId: "student-b",
        campusId: "campus-a",
        totalRecords: 8,
        presentFractionTotal: 76_000,
      },
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      studentProfileId: "student-a",
      attendanceBasisPoints: 7250,
    });
    expect(candidates[0]?.reasonSummary).toContain(
      "not a prediction or decision",
    );
    expect(attendanceReviewRule.version).toMatch(/^2026-/);
    expect(JSON.stringify(candidates)).not.toMatch(
      /caste|religion|medical|disability/i,
    );
  });
});
