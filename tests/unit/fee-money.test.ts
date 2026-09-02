import { describe, expect, it } from "vitest";

import {
  assertAllocationTotal,
  formatInr,
  parseInrToMinor,
  sumMinor,
} from "@/modules/fees/domain/money";

describe("fee money", () => {
  it("converts INR decimal strings to paise without floating-point arithmetic", () => {
    expect(parseInrToMinor("0.10")).toBe(10);
    expect(parseInrToMinor("1250.05")).toBe(125005);
    expect(parseInrToMinor("1")).toBe(100);
  });

  it("rejects imprecise, negative, or unsafe amounts", () => {
    expect(() => parseInrToMinor("1.001")).toThrow("valid INR");
    expect(() => parseInrToMinor("-1")).toThrow("valid INR");
    expect(() => sumMinor([Number.MAX_SAFE_INTEGER, 1])).toThrow("too large");
  });

  it("requires exact allocation and formats with Indian grouping", () => {
    expect(() => assertAllocationTotal(10_000, [4_000, 5_999])).toThrow(
      "equal",
    );
    expect(() => assertAllocationTotal(10_000, [4_000, 6_000])).not.toThrow();
    expect(formatInr(12_34_567_89)).toContain("12,34,567.89");
  });
});
