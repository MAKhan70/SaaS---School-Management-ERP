import { describe, expect, it } from "vitest";

import { safeReturnUrl } from "@/modules/identity/domain/auth-contracts";
import { hasTrustedMutationOrigin } from "@/modules/identity/domain/request-security";

describe("authentication boundary rules", () => {
  it.each([
    "https://attacker.test",
    "//attacker.test/path",
    "javascript:alert(1)",
    undefined,
  ])("rejects unsafe return URL %s", (value) => {
    expect(safeReturnUrl(value)).toBe("/dashboard");
  });

  it("preserves same-origin relative paths", () => {
    expect(safeReturnUrl("/dashboard?tab=security")).toBe(
      "/dashboard?tab=security",
    );
  });

  it("accepts a mutation only when origin and host match", () => {
    expect(
      hasTrustedMutationOrigin(
        new Headers({ host: "school.test", origin: "https://school.test" }),
      ),
    ).toBe(true);
    expect(
      hasTrustedMutationOrigin(
        new Headers({ host: "school.test", origin: "https://attacker.test" }),
      ),
    ).toBe(false);
  });
});
