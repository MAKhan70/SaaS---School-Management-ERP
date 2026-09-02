import { describe, expect, it } from "vitest";

import {
  analyticsCsv,
  analyticsQuerySchema,
  analyticsMetrics,
  type AnalyticsViewModel,
} from "@/modules/analytics/domain/analytics-contracts";

describe("analytics contracts", () => {
  it("exposes every requested analytics foundation", () => {
    expect(analyticsMetrics).toHaveLength(9);
    expect(analyticsMetrics).toContain("campus-comparison");
    expect(analyticsMetrics).toContain("student-support");
  });

  it("rejects a reversed reporting period", () => {
    expect(() =>
      analyticsQuerySchema.parse({ from: "2026-09-30", to: "2026-09-01" }),
    ).toThrow(/start date/i);
  });

  it("exports only aggregate chart rows and quotes CSV values", () => {
    const model: AnalyticsViewModel = {
      generatedAt: "2026-09-02T00:00:00.000Z",
      sourceUpdatedAt: "2026-09-01T00:00:00.000Z",
      freshness: "stale",
      freshnessDescription: "Stale",
      scope: {
        trustId: "trust-a",
        schoolId: "school-a",
        academicYearId: "year-a",
      },
      filters: { schools: [], campuses: [], academicYears: [] },
      series: [
        {
          metric: "enrollment",
          title: "Enrollment",
          description: "Aggregate only",
          valueLabel: "Students",
          points: [{ key: "2026-09", label: "Sep, 2026", value: 12 }],
        },
      ],
    };
    const csv = analyticsCsv(model);
    expect(csv).toContain('"enrollment","2026-09","Sep, 2026","12"');
    expect(csv).not.toContain("trust-a");
  });
});
