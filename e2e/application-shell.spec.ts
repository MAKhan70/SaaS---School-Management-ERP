import { expect, test } from "@playwright/test";

test("school administrator can search and open specialist workspaces", async ({
  page,
}) => {
  const password = process.env.DEMO_USER_PASSWORD;
  test.skip(
    !password,
    "DEMO_USER_PASSWORD is required for application shell E2E",
  );

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("school-admin@demo.nasaq.test");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("searchbox", { name: "Find a feature" }).fill("library");
  await page.getByRole("link", { name: "Library" }).click();
  await expect(page).toHaveURL(/\/operations\/library$/);
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
  await page.getByRole("button", { name: "Close navigation" }).click();
  await expect(
    page.getByRole("dialog", { name: "Navigation" }),
  ).not.toBeVisible();
});
