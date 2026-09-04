import { expect, test } from "@playwright/test";

test("unauthenticated institution access returns to sign in", async ({
  page,
}) => {
  await page.goto("/institutions");
  await expect(page).toHaveURL(/\/sign-in\?returnUrl=/);
});

test("school administrator can manage scoped institution profiles responsively", async ({
  page,
}) => {
  const password = process.env.DEMO_USER_PASSWORD;
  test.skip(!password, "DEMO_USER_PASSWORD is required for institution E2E");

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("school-admin@demo.nasaq.test");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("link", { name: "Institutions" }).click();

  await expect(page).toHaveURL(/\/institutions$/);
  await expect(
    page.getByRole("heading", { name: "Institutions", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Institution profiles" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Institutions", exact: true }),
  ).toBeVisible();
});
