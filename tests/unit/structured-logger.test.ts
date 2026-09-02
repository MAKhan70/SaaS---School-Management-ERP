import { createLogEntry } from "@/server/observability/logger";
import { describe, expect, it } from "vitest";

describe("structured logging", () => {
  it("redacts sensitive fields recursively and omits error messages", () => {
    const entry = createLogEntry(
      "error",
      "security.test",
      {
        token: "raw-token",
        email: "private@example.test",
        nested: { password: "raw-password", safe: "reason-code" },
        error: new Error("query contained private@example.test"),
      },
      new Date("2026-09-02T00:00:00.000Z"),
    );
    expect(entry).toMatchObject({
      timestamp: "2026-09-02T00:00:00.000Z",
      level: "error",
      event: "security.test",
      token: "[REDACTED]",
      email: "[REDACTED]",
      nested: { password: "[REDACTED]", safe: "reason-code" },
      error: { name: "Error" },
    });
    expect(JSON.stringify(entry)).not.toContain("private@example.test");
  });
});
