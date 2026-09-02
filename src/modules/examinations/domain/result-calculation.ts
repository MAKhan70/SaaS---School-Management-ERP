export type ResultRuleConfiguration = {
  exemptHandling: "EXCLUDE" | "ZERO";
  includeCoScholasticInPercentage: boolean;
  subjectAggregation: "EQUAL_SUBJECTS" | "TOTAL_MARKS";
  requireComponentPass: boolean;
  percentageScale: 2 | 3 | 4;
};

export type CalculationEntry = {
  subjectId: string;
  subjectName: string;
  componentId: string;
  componentName: string;
  maximumMarks: string;
  passingMarks?: string | null;
  weightagePercent: string;
  coScholastic: boolean;
  status: "MARKED" | "ABSENT" | "EXEMPT";
  marks?: string | null;
};

export type GradeBandInput = {
  code: string;
  name: string;
  minimumValue: string;
  maximumValue: string;
};

const powers = [1n, 10n, 100n, 1_000n, 10_000n] as const;

export function parseFixed(value: string, scale: number): bigint {
  if (!/^-?\d+(?:\.\d+)?$/.test(value))
    throw new Error("Invalid decimal value");
  const negative = value.startsWith("-");
  const [integerPart, fractionPart = ""] = value.replace("-", "").split(".");
  if (fractionPart.length > scale)
    throw new Error("Decimal precision exceeded");
  const factor = powers[scale];
  if (!factor) throw new Error("Unsupported decimal scale");
  const result =
    BigInt(integerPart ?? "0") * factor +
    BigInt(fractionPart.padEnd(scale, "0") || "0");
  return negative ? -result : result;
}

export function formatFixed(value: bigint, scale: number): string {
  const factor = powers[scale];
  if (!factor) throw new Error("Unsupported decimal scale");
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const integer = absolute / factor;
  const fraction = (absolute % factor).toString().padStart(scale, "0");
  return `${negative ? "-" : ""}${integer}${scale ? `.${fraction}` : ""}`;
}

function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n)
    throw new Error("Division requires a positive denominator");
  return (numerator * 2n + denominator) / (denominator * 2n);
}

export function marksDoNotExceedMaximum(
  marks: string,
  maximum: string,
): boolean {
  const value = parseFixed(marks, 2);
  return value >= 0n && value <= parseFixed(maximum, 2);
}

export function calculateResult(
  entries: readonly CalculationEntry[],
  rules: ResultRuleConfiguration,
  gradeBands: readonly GradeBandInput[],
) {
  if (!entries.length) throw new Error("At least one mark entry is required");
  const grouped = new Map<string, CalculationEntry[]>();
  for (const entry of entries)
    grouped.set(entry.subjectId, [
      ...(grouped.get(entry.subjectId) ?? []),
      entry,
    ]);

  let aggregateMaximum = 0n;
  let aggregateObtained = 0n;
  const subjectResults = [...grouped.entries()].map(([subjectId, items]) => {
    let maximum = 0n;
    let obtained = 0n;
    let weightedPercentage = 0n;
    let includedWeight = 0n;
    let passed = true;
    const components = items.map((item) => {
      const max = parseFixed(item.maximumMarks, 2);
      const pass = item.passingMarks ? parseFixed(item.passingMarks, 2) : null;
      const weight = parseFixed(item.weightagePercent, 2);
      const excluded =
        item.status === "EXEMPT" && rules.exemptHandling === "EXCLUDE";
      const score =
        item.status === "MARKED" ? parseFixed(item.marks ?? "", 2) : 0n;
      if (score > max) throw new Error("Marks exceed the configured maximum");
      if (!excluded) {
        maximum += max;
        obtained += score;
        includedWeight += weight;
        weightedPercentage += divideHalfUp(score * 1_000_000n, max) * weight;
        if (rules.requireComponentPass && pass !== null && score < pass)
          passed = false;
        if (item.status === "ABSENT") passed = false;
      }
      return {
        componentId: item.componentId,
        componentName: item.componentName,
        maximumMarks: formatFixed(max, 2),
        obtainedMarks: excluded ? null : formatFixed(score, 2),
        status: item.status,
        excluded,
      };
    });
    if (includedWeight === 0n)
      throw new Error("A subject has no included weightage");
    const percentage = divideHalfUp(weightedPercentage, includedWeight);
    aggregateMaximum += maximum;
    aggregateObtained += obtained;
    return {
      subjectId,
      subjectName: items[0]!.subjectName,
      maximumMarks: formatFixed(maximum, 2),
      obtainedMarks: formatFixed(obtained, 2),
      percentage: formatFixed(percentage, 4),
      passed,
      coScholastic: items.every((item) => item.coScholastic),
      components,
    };
  });

  const percentageSubjects = subjectResults.filter(
    (subject) => rules.includeCoScholasticInPercentage || !subject.coScholastic,
  );
  if (!percentageSubjects.length)
    throw new Error("No scholastic subject is available");
  const percentage =
    rules.subjectAggregation === "TOTAL_MARKS"
      ? divideHalfUp(
          percentageSubjects.reduce(
            (total, subject) =>
              total + parseFixed(subject.obtainedMarks, 2) * 1_000_000n,
            0n,
          ),
          percentageSubjects.reduce(
            (total, subject) => total + parseFixed(subject.maximumMarks, 2),
            0n,
          ),
        )
      : divideHalfUp(
          percentageSubjects.reduce(
            (total, subject) => total + parseFixed(subject.percentage, 4),
            0n,
          ),
          BigInt(percentageSubjects.length),
        );
  const scaleFactor = powers[4 - rules.percentageScale]!;
  const rounded = divideHalfUp(percentage, scaleFactor) * scaleFactor;
  const grade = gradeBands.find(
    (band) =>
      rounded >= parseFixed(band.minimumValue, 4) &&
      rounded <= parseFixed(band.maximumValue, 4),
  );
  return {
    totalMaximumMarks: formatFixed(aggregateMaximum, 2),
    totalObtainedMarks: formatFixed(aggregateObtained, 2),
    percentage: formatFixed(rounded, 4),
    gradeCode: grade?.code ?? null,
    gradeName: grade?.name ?? null,
    passed: subjectResults.every((subject) => subject.passed),
    subjects: subjectResults,
  };
}
