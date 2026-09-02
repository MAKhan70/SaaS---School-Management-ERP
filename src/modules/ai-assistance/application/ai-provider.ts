import type { AiFeature } from "@/modules/ai-assistance/domain/ai-contracts";

export type SafeAssistanceContext = Record<string, string | number | boolean>;

export interface AiDraftProvider {
  readonly kind: "LOCAL_MOCK" | "EXTERNAL";
  readonly version: string;
  generate(feature: AiFeature, context: SafeAssistanceContext): Promise<string>;
}

function value(context: SafeAssistanceContext, key: string, fallback: string) {
  return String(context[key] ?? fallback);
}

export function deterministicFallback(
  feature: AiFeature,
  context: SafeAssistanceContext,
): string {
  switch (feature) {
    case "REPORT_CARD_REMARK":
      return `Draft for staff review: The learner demonstrated ${value(context, "strength", "steady participation")}. Consider noting progress in ${value(context, "focusArea", "the selected learning objective")} and one practical next step.`;
    case "HOMEWORK_QUESTIONS":
      return `Draft for teacher review:\n1. Explain the central idea in ${value(context, "topic", "the selected topic")}.\n2. Apply the idea to a familiar example.\n3. Check your answer and describe one alternative approach.`;
    case "LESSON_PLAN_OUTLINE":
      return `Draft for teacher review: Begin with a short prior-knowledge check for ${value(context, "topic", "the selected topic")}; model the objective; guide practice; allow independent application; close with an exit check and accommodation review.`;
    case "NATURAL_LANGUAGE_FILTER":
      return `Non-AI fallback filter: metric=${value(context, "metric", "enrollment")}; period=${value(context, "period", "current-academic-year")}. Review and apply the structured filters before running the report.`;
    case "ADMIN_REPORT_SUMMARY":
      return `Draft for staff review: Summarise the selected aggregate report, describe the period and scope, identify the largest observable change, and state that correlation does not establish cause.`;
  }
}

export class LocalMockAiProvider implements AiDraftProvider {
  readonly kind = "LOCAL_MOCK" as const;
  readonly version = "local-mock-2026-09-01";

  async generate(
    feature: AiFeature,
    context: SafeAssistanceContext,
  ): Promise<string> {
    return `${deterministicFallback(feature, context)}\n\nGenerated locally. This is a draft and requires an authorised human reviewer.`;
  }
}
