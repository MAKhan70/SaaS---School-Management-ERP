import { describe, expect, it } from "vitest";

import { feeMutationSchema } from "@/modules/fees/domain/fee-contracts";

describe("fee input contracts", () => {
  it("accepts a payment with exact string amounts and an idempotency key", () => {
    const parsed = feeMutationSchema.parse({
      action: "payment.post",
      studentProfileId: "student",
      idempotencyKey: "pay-unique-001",
      method: "UPI",
      amount: "1000.25",
      paidAt: "2026-09-02T10:00:00+05:30",
      allocations: [{ assignmentId: "assignment", amount: "1000.25" }],
    });
    expect(parsed).toMatchObject({ action: "payment.post", amount: "1000.25" });
  });

  it("does not accept card detail fields or sub-paise values", () => {
    expect(
      feeMutationSchema.safeParse({
        action: "payment.post",
        studentProfileId: "student",
        idempotencyKey: "pay-unique-002",
        method: "CARD",
        amount: "10.001",
        paidAt: "2026-09-02T10:00:00+05:30",
        cardNumber: "4111111111111111",
        allocations: [{ assignmentId: "assignment", amount: "10.001" }],
      }).success,
    ).toBe(false);
  });

  it("accepts a scoped class-level structure assignment command", () => {
    expect(
      feeMutationSchema.parse({
        action: "assignment.class.apply",
        feeStructureId: "structure",
        sectionId: "section",
      }),
    ).toEqual({
      action: "assignment.class.apply",
      feeStructureId: "structure",
      sectionId: "section",
    });
  });
});
