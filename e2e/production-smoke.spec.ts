import { expect, test } from "@playwright/test";

test("liveness is fast and carries browser security headers", async ({
  request,
}) => {
  const started = Date.now();
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(Date.now() - started).toBeLessThan(2_000);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  await expect(response.json()).resolves.toMatchObject({ status: "ok" });
});

test("sign-in remains keyboard accessible on a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/sign-in");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).not.toHaveCount(0);
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});
