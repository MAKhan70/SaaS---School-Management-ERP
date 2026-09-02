import { expect, test } from "@playwright/test";

const experiences = [
  ["school-admin", "School administrator dashboard"],
  ["principal", "Principal dashboard"],
  ["teacher", "Teacher portal"],
  ["student", "Student portal"],
  ["parent", "Parent portal"],
  ["accountant", "Accountant portal"],
] as const;

for (const [user, heading] of experiences) {
  test(`${user} receives the authorized dashboard experience`, async ({
    page,
  }) => {
    const password = process.env.DEMO_USER_PASSWORD;
    test.skip(
      !password,
      "DEMO_USER_PASSWORD is required for seeded role dashboard tests",
    );
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(`${user}@demo.nasaq.test`);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(
      page.getByRole("form", { name: "Dashboard filters" }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  });
}
