import { expect, test } from "@playwright/test";

test.describe("attendance workspace", () => {
  test("unauthenticated attendance access returns to sign in", async ({
    page,
  }) => {
    await page.goto("/attendance");
    await expect(page).toHaveURL(/\/sign-in\?returnUrl=/);
  });

  test("administrator can use the accessible mobile register and sees offline drafts as unsynchronized", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const password = process.env.DEMO_USER_PASSWORD;
    test.skip(!password, "DEMO_USER_PASSWORD is required for attendance E2E");

    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill("school-admin@demo.nasaq.test");
    await page.getByLabel("Password").fill(password ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.goto("/attendance");

    await expect(
      page.getByRole("heading", { name: "Attendance workspace" }),
    ).toBeVisible();
    await expect(page.getByLabel("Class and section")).toBeVisible();
    await expect(page.getByLabel("Attendance mode")).toContainText(
      "Daily attendance",
    );
    await expect(
      page.getByRole("group", { name: /Attendance status for/ }).first(),
    ).toBeVisible();

    await page.context().setOffline(true);
    await expect(
      page.getByText(/not part of the official attendance register/),
    ).toBeVisible();
    await page.getByLabel("Absent").first().check();
    await page.getByRole("button", { name: "Submit attendance" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "not synchronized" }),
    ).toBeVisible();
    await page.context().setOffline(false);
    await expect(
      page.getByText("Online · local draft not yet synchronized"),
    ).toBeVisible();
  });
});
