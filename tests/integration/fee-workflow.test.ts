import { PrismaClient } from "@/generated/prisma";
import { FeeService } from "@/modules/fees/application/fee-service";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import { afterAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const service = new FeeService(prisma);
const suffix = crypto.randomUUID().slice(0, 8);
const scope = {
  trustId: "trust_saraswati_demo",
  schoolId: "school_saraswati_central_demo",
  campusId: "campus_cbse_pune_demo",
  academicYearId: "academic_year_2026_27_demo",
};
function context(
  userId: string,
  permissionKeys: string[],
): AuthenticatedContext {
  return {
    sessionId: `fee-${userId}`,
    userId,
    displayName: "Synthetic Finance User",
    email: `${userId}@example.test`,
    ...scope,
    trustName: "Synthetic Trust",
    academicYearName: "2026-27",
    permissionKeys,
    permissionGrants: [
      {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        scope: "SCHOOL",
        permissionKeys,
        effectiveFrom: new Date("2026-04-01"),
        active: true,
      },
    ],
    schools: [],
  };
}
const accountant = context("user_demo_accountant", [
  "finance.fees.read",
  "finance.payments.collect",
  "finance.adjustments.request",
  "finance.refunds.request",
]);
const administrator = context("user_demo_school_admin", [
  "finance.adjustments.approve",
  "finance.refunds.approve",
]);
const metadata = {
  correlationId: `fee-integration-${suffix}`,
  ipHash: "synthetic",
};

describe("fee posting workflow", () => {
  afterAll(async () => prisma.$disconnect());

  it("posts payment and receipt atomically and returns the same result for an identical idempotency retry", async () => {
    const input = {
      action: "payment.post" as const,
      studentProfileId: "student_profile_demo",
      idempotencyKey: `fee-payment-${suffix}`,
      method: "UPI" as const,
      amount: "100.00",
      paidAt: "2026-09-02T10:30:00+05:30",
      instrumentReference: `UPI-SYNTHETIC-${suffix}`,
      allocations: [
        {
          assignmentId: "student_fee_assignment_tuition_demo",
          amount: "100.00",
        },
      ],
    };
    const first = await service.mutate(accountant, input, metadata);
    const retry = await service.mutate(accountant, input, metadata);
    expect(first).toMatchObject({
      id: expect.any(String),
      amountMinor: 10000,
      receipt: { receiptNumber: expect.stringMatching(/^RCPT\//) },
    });
    expect(retry).toMatchObject({ id: first.id, amountMinor: 10000 });
    expect(
      await prisma.feeReceipt.count({ where: { paymentId: first.id } }),
    ).toBe(1);
    expect(
      await prisma.financialAuditEntry.count({
        where: { resourceType: "FeePayment", resourceId: first.id },
      }),
    ).toBe(1);
  });

  it("rejects reuse of an idempotency key for changed payment data", async () => {
    const key = `fee-conflict-${suffix}`;
    const base = {
      action: "payment.post" as const,
      studentProfileId: "student_profile_demo",
      idempotencyKey: key,
      method: "CASH" as const,
      paidAt: "2026-09-02T11:00:00+05:30",
      allocations: [
        { assignmentId: "student_fee_assignment_tuition_demo", amount: "1.00" },
      ],
    };
    await service.mutate(accountant, { ...base, amount: "1.00" }, metadata);
    await expect(
      service.mutate(
        accountant,
        {
          ...base,
          amount: "2.00",
          allocations: [
            {
              assignmentId: "student_fee_assignment_tuition_demo",
              amount: "2.00",
            },
          ],
        },
        metadata,
      ),
    ).rejects.toThrow("different payment data");
  });

  it("enforces independent adjustment approval and writes the financial audit only after approval", async () => {
    const requested = await service.mutate(
      accountant,
      {
        action: "adjustment.request",
        assignmentId: "student_fee_assignment_tuition_demo",
        kind: "CONCESSION",
        amount: "50.00",
        reason: "Synthetic merit concession evidence",
      },
      metadata,
    );
    await expect(
      service.mutate(
        context("user_demo_accountant", ["finance.adjustments.approve"]),
        {
          action: "adjustment.decide",
          adjustmentId: requested.id,
          approve: true,
          note: "Synthetic approval evidence reviewed",
        },
        metadata,
      ),
    ).rejects.toThrow("different user");
    const approved = await service.mutate(
      administrator,
      {
        action: "adjustment.decide",
        adjustmentId: requested.id,
        approve: true,
        note: "Synthetic approval evidence reviewed",
      },
      metadata,
    );
    expect(approved).toMatchObject({
      approvalState: "APPROVED",
      amountMinor: 5000,
    });
    expect(
      await prisma.financialAuditEntry.findFirst({
        where: { resourceType: "FeeAdjustment", resourceId: requested.id },
      }),
    ).toMatchObject({ direction: "CREDIT", amountMinor: 5000 });
  });
});
