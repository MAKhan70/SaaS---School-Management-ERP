import { describe, expect, it } from "vitest";

import { csvCell } from "@/lib/csv";

describe("CSV export safety", () => {
  it.each(["=1+1", "+cmd", "-2+3", "@SUM(A:A)", "\tformula", "\rformula"])(
    "neutralizes spreadsheet formula input %s",
    (value) => {
      expect(csvCell(value)).toBe(`"'${value}"`);
    },
  );

  it("escapes quotes", () => {
    expect(csvCell('Synthetic "Student"')).toBe('"Synthetic ""Student"""');
  });
});
