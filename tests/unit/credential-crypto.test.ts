import { describe, expect, it } from "vitest";

import {
  hashPassword,
  verifyPassword,
} from "@/modules/identity/infrastructure/credential-crypto";

describe("credential crypto", () => {
  it("hashes passwords with a random salt and verifies only the matching value", async () => {
    const first = await hashPassword("FictionalPass123");
    const second = await hashPassword("FictionalPass123");

    expect(first).not.toBe(second);
    await expect(verifyPassword("FictionalPass123", first)).resolves.toBe(true);
    await expect(verifyPassword("WrongPass123", first)).resolves.toBe(false);
    expect(first).not.toContain("FictionalPass123");
  });
});
