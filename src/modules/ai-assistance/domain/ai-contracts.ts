import { z } from "zod";

export const aiFeatures = [
  "REPORT_CARD_REMARK",
  "HOMEWORK_QUESTIONS",
  "LESSON_PLAN_OUTLINE",
  "NATURAL_LANGUAGE_FILTER",
  "ADMIN_REPORT_SUMMARY",
] as const;

export type AiFeature = (typeof aiFeatures)[number];

const safeText = z.string().trim().min(3).max(2_000);
const identifier = z.string().min(1).max(100);

const baseDraft = z.object({
  action: z.literal("CREATE_DRAFT"),
  feature: z.enum(aiFeatures),
  schoolId: identifier.optional(),
  campusId: identifier.optional(),
  academicYearId: identifier.optional(),
  context: z.record(
    z.string().max(60),
    z.union([z.string().max(500), z.number(), z.boolean()]),
  ),
});

export const aiDraftRequestSchema = baseDraft.superRefine((value, context) => {
  const forbiddenKeys = [
    "name",
    "email",
    "phone",
    "aadhaar",
    "caste",
    "religion",
    "disability",
    "medical",
    "diagnosis",
    "address",
  ];
  for (const key of Object.keys(value.context)) {
    const normalized = key.toLowerCase();
    if (forbiddenKeys.some((forbidden) => normalized.includes(forbidden))) {
      context.addIssue({
        code: "custom",
        path: ["context", key],
        message:
          "Personal or sensitive attributes are not accepted as AI context",
      });
    }
  }
});

export const aiReviewRequestSchema = z
  .object({
    action: z.literal("REVIEW_DRAFT"),
    draftId: identifier,
    decision: z.enum(["ACCEPT", "EDIT", "DISMISS"]),
    reviewerNote: safeText,
    finalOutput: z.string().trim().min(3).max(8_000).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === "EDIT" && !value.finalOutput) {
      context.addIssue({
        code: "custom",
        path: ["finalOutput"],
        message: "Edited output is required when accepting with edits",
      });
    }
  });

export const supportIndicatorReviewSchema = z.object({
  action: z.literal("REVIEW_INDICATOR"),
  indicatorId: identifier,
  decision: z.enum(["CORRECT", "DISMISS", "RESOLVE", "REOPEN"]),
  reviewerNote: safeText,
  correctedFactors: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/),
        label: z.string().min(2).max(120),
        value: z.number().finite(),
        explanation: z.string().min(3).max(300),
      }),
    )
    .max(10)
    .optional(),
});

export const refreshIndicatorsSchema = z.object({
  action: z.literal("REFRESH_INDICATORS"),
  schoolId: identifier.optional(),
  campusId: identifier.optional(),
  academicYearId: identifier.optional(),
});

export const aiAssistanceMutationSchema = z.discriminatedUnion("action", [
  aiDraftRequestSchema,
  aiReviewRequestSchema,
  supportIndicatorReviewSchema,
  refreshIndicatorsSchema,
]);

export type AiAssistanceMutation = z.infer<typeof aiAssistanceMutationSchema>;

export type SupportFactor = {
  key: string;
  label: string;
  value: number;
  explanation: string;
};

export const forbiddenDecisionLanguage = [
  "admit this student",
  "reject this student",
  "discipline this student",
  "award scholarship",
  "deny scholarship",
  "promote this student",
  "detain this student",
  "approve payment",
  "deny refund",
] as const;

export function assertDraftIsAdvisory(output: string): void {
  const normalized = output.toLowerCase();
  if (forbiddenDecisionLanguage.some((phrase) => normalized.includes(phrase))) {
    throw new Error(
      "Assistance output attempted to make a prohibited decision",
    );
  }
}
