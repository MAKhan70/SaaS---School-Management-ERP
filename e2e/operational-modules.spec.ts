import { expect, test } from "@playwright/test";

test("unauthenticated operational access returns to sign in", async ({
  page,
}) => {
  await page.goto("/operations");
  await expect(page).toHaveURL(/\/sign-in\?returnUrl=/);
});

test("school administrator can browse all operational modules responsively", async ({
  page,
}) => {
  const password = process.env.DEMO_USER_PASSWORD;
  test.skip(!password, "DEMO_USER_PASSWORD is required for operational E2E");
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("school-admin@demo.nasaq.test");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/operations");
  await expect(
    page.getByRole("heading", { name: "Operational modules" }),
  ).toBeVisible();
  await expect(page.locator(".operational-module-card")).toHaveCount(21);
  await page.getByRole("link", { name: "Open Help desk and support" }).click();
  await expect(
    page.getByRole("heading", { name: "Help desk and support" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Work records" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Search")).toBeVisible();
});
