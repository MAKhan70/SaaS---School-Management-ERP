import { describe, expect, it } from "vitest";

import {
  calculateResult,
  formatFixed,
  marksDoNotExceedMaximum,
  parseFixed,
} from "@/modules/examinations/domain/result-calculation";

const rules = {
  exemptHandling: "EXCLUDE" as const,
  includeCoScholasticInPercentage: false,
  subjectAggregation: "EQUAL_SUBJECTS" as const,
  requireComponentPass: true,
  percentageScale: 2 as const,
};

const bands = [
  { code: "A", name: "A", minimumValue: "80", maximumValue: "100" },
  { code: "B", name: "B", minimumValue: "60", maximumValue: "79.9999" },
  { code: "E", name: "E", minimumValue: "0", maximumValue: "59.9999" },
];

describe("decimal-safe examination result calculation", () => {
  it("parses and formats fixed-point values without floating-point arithmetic", () => {
    expect(parseFixed("0.10", 2)).toBe(10n);
    expect(formatFixed(10n, 2)).toBe("0.10");
    expect(marksDoNotExceedMaximum("20.01", "20.00")).toBe(false);
  });

  it("applies component weightages and rounds half-up", () => {
    const result = calculateResult(
      [
        {
          subjectId: "math",
          subjectName: "Mathematics",
          componentId: "internal",
          componentName: "Internal",
          maximumMarks: "20",
          passingMarks: "7",
          weightagePercent: "20",
          coScholastic: false,
          status: "MARKED",
          marks: "18",
        },
        {
          subjectId: "math",
          subjectName: "Mathematics",
          componentId: "theory",
          componentName: "Theory",
          maximumMarks: "80",
          passingMarks: "26",
          weightagePercent: "80",
          coScholastic: false,
          status: "MARKED",
          marks: "60",
        },
      ],
      rules,
      bands,
    );
    expect(result).toMatchObject({
      totalMaximumMarks: "100.00",
      totalObtainedMarks: "78.00",
      percentage: "78.0000",
      gradeCode: "B",
      passed: true,
    });
  });

  it("treats absence as zero and excludes exempt components according to rules", () => {
    const result = calculateResult(
      [
        {
          subjectId: "science",
          subjectName: "Science",
          componentId: "project",
          componentName: "Project",
          maximumMarks: "20",
          passingMarks: "7",
          weightagePercent: "20",
          coScholastic: false,
          status: "EXEMPT",
        },
        {
          subjectId: "science",
          subjectName: "Science",
          componentId: "theory",
          componentName: "Theory",
          maximumMarks: "80",
          passingMarks: "26",
          weightagePercent: "80",
          coScholastic: false,
          status: "ABSENT",
        },
      ],
      rules,
      bands,
    );
    expect(result.percentage).toBe("0.0000");
    expect(result.passed).toBe(false);
    expect(result.subjects[0]?.components[0]).toMatchObject({ excluded: true });
  });

  it("rejects marks over the configured maximum", () => {
    expect(() =>
      calculateResult(
        [
          {
            subjectId: "math",
            subjectName: "Mathematics",
            componentId: "theory",
            componentName: "Theory",
            maximumMarks: "80",
            weightagePercent: "100",
            coScholastic: false,
            status: "MARKED",
            marks: "80.01",
          },
        ],
        rules,
        bands,
      ),
    ).toThrow("exceed");
  });

  it("excludes co-scholastic subjects from total-marks aggregation when configured", () => {
    const result = calculateResult(
      [
        {
          subjectId: "math",
          subjectName: "Mathematics",
          componentId: "theory",
          componentName: "Theory",
          maximumMarks: "100",
          weightagePercent: "100",
          coScholastic: false,
          status: "MARKED",
          marks: "80",
        },
        {
          subjectId: "work-education",
          subjectName: "Work education",
          componentId: "observation",
          componentName: "Observation",
          maximumMarks: "100",
          weightagePercent: "100",
          coScholastic: true,
          status: "MARKED",
          marks: "20",
        },
      ],
      { ...rules, subjectAggregation: "TOTAL_MARKS" },
      bands,
    );
    expect(result.percentage).toBe("80.0000");
    expect(result.gradeCode).toBe("A");
  });
});
