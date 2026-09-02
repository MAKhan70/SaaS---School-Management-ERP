import { privateStorageKeySchema } from "@/lib/private-file-policy";
import { describe, expect, it } from "vitest";
import { safeReturnUrl } from "@/modules/identity/domain/auth-contracts";
import {
  hasSafeFetchMetadata,
  hasTrustedMutationOrigin,
  requestMetadata,
} from "@/modules/identity/domain/request-security";

describe("request security regression controls", () => {
  it("pins mutation origins to the configured public origin", () => {
    const previous = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = "https://schools.example.test";
    expect(
      hasTrustedMutationOrigin(
        new Headers({
          origin: "https://schools.example.test",
          "x-forwarded-host": "attacker.example.test",
        }),
      ),
    ).toBe(true);
    expect(
      hasTrustedMutationOrigin(
        new Headers({ origin: "https://attacker.example.test" }),
      ),
    ).toBe(false);
    if (previous === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previous;
  });

  it("rejects cross-site Fetch Metadata and open redirects", () => {
    expect(
      hasSafeFetchMetadata(new Headers({ "sec-fetch-site": "cross-site" })),
    ).toBe(false);
    expect(safeReturnUrl("//attacker.example.test/path")).toBe("/dashboard");
    expect(safeReturnUrl("/dashboard?school=one")).toBe(
      "/dashboard?school=one",
    );
  });

  it("accepts only private non-traversing object keys", () => {
    expect(
      privateStorageKeySchema.safeParse("private/trust/random-file").success,
    ).toBe(true);
    expect(
      privateStorageKeySchema.safeParse("public/student.pdf").success,
    ).toBe(false);
    expect(
      privateStorageKeySchema.safeParse("private/trust/../secret").success,
    ).toBe(false);
  });

  it("accepts only bounded safe correlation identifiers", () => {
    expect(
      requestMetadata(new Headers({ "x-correlation-id": "release:123" }))
        .correlationId,
    ).toBe("release:123");
    expect(
      requestMetadata(
        new Headers({ "x-correlation-id": "student@example.test" }),
      ).correlationId,
    ).not.toBe("student@example.test");
  });
});
