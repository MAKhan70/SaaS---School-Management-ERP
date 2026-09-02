import { expect, test } from "@playwright/test";

test("unauthenticated analytics access returns to sign in", async ({
  page,
}) => {
  await page.goto("/analytics");
  await expect(page).toHaveURL(/\/sign-in\?returnUrl=/);
});

test("administrator reviews accessible analytics and local draft safeguards", async ({
  page,
}) => {
  const password = process.env.DEMO_USER_PASSWORD;
  test.skip(!password, "DEMO_USER_PASSWORD is required for analytics E2E");
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("school-admin@demo.nasaq.test");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Analytics and assisted drafting" }),
  ).toBeVisible();
  await expect(page.getByText(/Data freshness:/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Responsible-use boundary" }),
  ).toBeVisible();
  await expect(
    page.getByText(/All generated content is a draft/),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeVisible();
});
