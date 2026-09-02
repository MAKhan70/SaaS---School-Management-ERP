import { expect, test } from "@playwright/test";

const password = process.env.DEMO_USER_PASSWORD;

test("NASAQ operator can open the client control plane", async ({ page }) => {
  test.skip(
    !password,
    "DEMO_USER_PASSWORD is required for authenticated E2E coverage",
  );
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("trust-admin@demo.nasaq.test");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/platform/clients");
  await expect(
    page.getByRole("heading", { name: "Client administration" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Onboard a school client" }),
  ).toBeVisible();
  await expect(page.getByLabel("Educational trust name")).toBeVisible();
});

test("an ordinary tenant URL cannot expose the control plane without authentication", async ({
  page,
}) => {
  await page.goto("/platform/clients");
  await expect(page).toHaveURL(/\/sign-in\?returnUrl=/);
});
