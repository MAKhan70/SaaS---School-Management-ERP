import { z } from "zod";

import { csvCell } from "@/lib/csv";

const identifier = z.string().min(1).max(100);

export const analyticsMetrics = [
  "enrollment",
  "admissions",
  "attendance",
  "academic-performance",
  "fee-collection",
  "outstanding-fees",
  "teacher-workload",
  "student-support",
  "campus-comparison",
] as const;

export type AnalyticsMetric = (typeof analyticsMetrics)[number];

export const analyticsQuerySchema = z
  .object({
    schoolId: identifier.optional(),
    campusId: identifier.optional(),
    academicYearId: identifier.optional(),
    gradeClassId: identifier.optional(),
    sectionId: identifier.optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    metric: z.enum(analyticsMetrics).optional(),
    format: z.enum(["json", "csv"]).default("json"),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "The analytics start date must not be after the end date",
  );

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export type AnalyticsPoint = {
  key: string;
  label: string;
  value: number;
  secondaryValue?: number;
};

export type AnalyticsSeries = {
  metric: AnalyticsMetric;
  title: string;
  description: string;
  valueLabel: string;
  points: AnalyticsPoint[];
};

export type AnalyticsViewModel = {
  generatedAt: string;
  sourceUpdatedAt: string;
  freshness: "fresh" | "stale" | "unavailable";
  freshnessDescription: string;
  scope: {
    trustId: string;
    schoolId: string;
    campusId?: string;
    academicYearId: string;
  };
  filters: {
    schools: { id: string; name: string }[];
    campuses: { id: string; name: string }[];
    academicYears: { id: string; name: string }[];
  };
  series: AnalyticsSeries[];
};

export function analyticsCsv(
  model: AnalyticsViewModel,
  metric?: AnalyticsMetric,
): string {
  const rows = [
    ["metric", "key", "label", "value", "secondary_value", "generated_at"],
    ...model.series
      .filter((series) => !metric || series.metric === metric)
      .flatMap((series) =>
        series.points.map((point) => [
          series.metric,
          point.key,
          point.label,
          point.value,
          point.secondaryValue ?? "",
          model.generatedAt,
        ]),
      ),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
