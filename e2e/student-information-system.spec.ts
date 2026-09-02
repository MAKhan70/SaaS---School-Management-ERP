import { expect, test } from "@playwright/test";

test.describe("student information system access", () => {
  test("unauthenticated student routes return to sign in", async ({ page }) => {
    await page.goto("/students");
    await expect(page).toHaveURL(/\/sign-in\?returnUrl=/);
  });

  test("synthetic administrator can browse directory, filters, profile tabs, and import preview", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const password = process.env.DEMO_USER_PASSWORD;
    test.skip(
      !password,
      "DEMO_USER_PASSWORD is required for the seeded SIS journey",
    );
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill("school-admin@demo.nasaq.test");
    await page.getByLabel("Password").fill(password ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.goto("/students");
    await expect(page.getByRole("heading", { name: "Students" })).toBeVisible();
    await expect(page.getByLabel("Search students")).toBeVisible();
    const profileLink = page.locator(
      'tbody a[href="/students/student_profile_demo"]',
    );
    const profileResponse = page.waitForResponse(
      (response) => /\/api\/v1\/students\/[^/]+$/.test(response.url()),
      { timeout: 30_000 },
    );
    await profileLink.click();
    expect((await profileResponse).status()).toBe(200);
    await expect(
      page.getByRole("navigation", { name: "Student profile sections" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", {
        name: "Enrolment timeline and academic history",
      }),
    ).toBeVisible();
    await page.goto("/students/import");
    await expect(
      page.getByRole("heading", { name: "Import students" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download CSV template" }),
    ).toBeVisible();
  });
});
