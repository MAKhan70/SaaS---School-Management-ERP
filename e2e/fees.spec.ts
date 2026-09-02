import { expect, test } from "@playwright/test";

test.describe("school fees", () => {
  test("unauthenticated fee access returns to sign in", async ({ page }) => {
    await page.goto("/fees");
    await expect(page).toHaveURL(/\/sign-in\?returnUrl=/);
  });

  test("authorized accountant can review the ledger and payment form", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const password = process.env.DEMO_USER_PASSWORD;
    test.skip(!password, "DEMO_USER_PASSWORD is required for fee E2E");
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill("accountant@demo.nasaq.test");
    await page.getByLabel("Password").fill(password ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.goto("/fees");
    await expect(
      page.getByRole("heading", { name: "School fee management" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Student fee ledger" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Collect payment" }).click();
    await expect(page.getByLabel("Payment method")).toBeVisible();
    await expect(
      page.getByText(/Card details are never collected/),
    ).toBeVisible();
  });
});
