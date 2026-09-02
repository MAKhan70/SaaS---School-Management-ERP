import { describe, expect, it } from "vitest";

import { evaluatePermission } from "@/modules/identity/authorization/permission-evaluator";

const grant = (keys: string[], trustId = "trust-a") => ({
  trustId,
  schoolId: "school-a",
  scope: "SCHOOL" as const,
  permissionKeys: keys,
  effectiveFrom: new Date("2026-01-01"),
  active: true,
});
const request = (permissionKey: string, trustId = "trust-a") => ({
  actorUserId: "accountant",
  activeTrustId: "trust-a",
  permissionKey,
  resource: { trustId, schoolId: "school-a" },
  now: new Date("2026-09-02"),
});

describe("fee permission separation", () => {
  it("does not infer refund approval from collection permission", () => {
    expect(
      evaluatePermission(request("finance.refunds.approve"), [
        grant(["finance.payments.collect"]),
      ]),
    ).toMatchObject({ allowed: false, reason: "PERMISSION_NOT_GRANTED" });
  });

  it("allows the explicit scoped permission and denies cross-trust resources", () => {
    expect(
      evaluatePermission(request("finance.refunds.approve"), [
        grant(["finance.refunds.approve"]),
      ]),
    ).toMatchObject({ allowed: true });
    expect(
      evaluatePermission(request("finance.refunds.approve", "trust-b"), [
        grant(["finance.refunds.approve"]),
      ]),
    ).toMatchObject({ allowed: false, reason: "ACTIVE_TRUST_MISMATCH" });
  });
});
