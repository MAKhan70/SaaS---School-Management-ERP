import { describe, expect, it } from "vitest";

import { sameOriginRedirect } from "@/server/http/same-origin-redirect";

describe("same-origin redirect response", () => {
  it("keeps redirects relative so reverse proxies preserve the public host", () => {
    const response = sameOriginRedirect("/dashboard");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/dashboard");
  });

  it.each(["https://attacker.example/path", "//attacker.example/path"])(
    "rejects the unsafe redirect target %s",
    (path) => {
      expect(() => sameOriginRedirect(path)).toThrow(
        "Redirect path must be same-origin",
      );
    },
  );
});
