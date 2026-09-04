import { privateStorageKeySchema } from "@/lib/private-file-policy";
import { afterEach, describe, expect, it, vi } from "vitest";
import { safeReturnUrl } from "@/modules/identity/domain/auth-contracts";
import {
  hasSafeFetchMetadata,
  hasTrustedMutationOrigin,
  requestMetadata,
} from "@/modules/identity/domain/request-security";
import { sessionCookieOptions } from "@/server/auth/session";

describe("request security regression controls", () => {
  afterEach(() => vi.unstubAllEnvs());

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

  it("accepts a same-host HTTPS development preview behind a proxy", () => {
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("NODE_ENV", "development");

    const headers = new Headers({
      origin: "https://fictional-preview-3000.app.github.dev",
      "x-forwarded-host": "fictional-preview-3000.app.github.dev",
      "x-forwarded-proto": "https",
    });
    expect(hasTrustedMutationOrigin(headers)).toBe(true);

    headers.set("origin", "https://attacker.example.test");
    expect(hasTrustedMutationOrigin(headers)).toBe(false);
  });

  it("accepts the external host when a development proxy rewrites its forwarded host", () => {
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("NODE_ENV", "development");

    expect(
      hasTrustedMutationOrigin(
        new Headers({
          origin: "https://fictional-preview-3000.app.github.dev",
          host: "fictional-preview-3000.app.github.dev",
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe(true);
  });

  it("accepts only this Codespace forwarding origin in development", () => {
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CODESPACE_NAME", "fictional-preview");
    vi.stubEnv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", "app.github.dev");

    expect(
      hasTrustedMutationOrigin(
        new Headers({
          origin: "https://fictional-preview-3000.app.github.dev",
          host: "localhost:3000",
          "x-forwarded-host": "internal-forwarder",
          "x-forwarded-proto": "http",
        }),
      ),
    ).toBe(true);
    expect(
      hasTrustedMutationOrigin(
        new Headers({ origin: "https://other-3000.app.github.dev" }),
      ),
    ).toBe(false);
    expect(
      hasTrustedMutationOrigin(
        new Headers({
          origin: "https://fictional-preview-attacker.app.github.dev",
        }),
      ),
    ).toBe(false);
  });

  it("marks forwarded HTTPS preview session cookies as secure", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(
      sessionCookieOptions(
        undefined,
        new Headers({ "x-forwarded-proto": "https" }),
      ).secure,
    ).toBe(true);
    expect(sessionCookieOptions().secure).toBe(false);
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
