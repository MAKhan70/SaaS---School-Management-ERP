import { expect, test } from "@playwright/test";

test.describe("examination gradebook", () => {
  test("unauthenticated examination access returns to sign in", async ({
    page,
  }) => {
    await page.goto("/examinations");
    await expect(page).toHaveURL(/\/sign-in\?returnUrl=/);
  });

  test("administrator can review the accessible gradebook and report actions", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const password = process.env.DEMO_USER_PASSWORD;
    test.skip(!password, "DEMO_USER_PASSWORD is required for examination E2E");

    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill("school-admin@demo.nasaq.test");
    await page.getByLabel("Password").fill(password ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.goto("/examinations");

    await expect(
      page.getByRole("heading", { name: "Examinations and gradebook" }),
    ).toBeVisible();
    await expect(page.getByLabel("Examination")).toBeVisible();
    await expect(page.getByLabel("Assigned subject and class")).toBeVisible();
    await expect(page.getByLabel("Report-card template")).toBeVisible();
    await expect(
      page.getByRole("table", { name: /Each component shows its maximum/ }),
    ).toBeVisible();
    await expect(page.getByText(/Max .* Pass .*%/).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Preview report card" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Generate all published reports" }),
    ).toBeVisible();
  });
});
