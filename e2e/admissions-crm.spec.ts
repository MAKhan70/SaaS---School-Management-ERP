import { expect, test } from "@playwright/test";

test.describe("admissions CRM", () => {
  test("submits a protected public enquiry with a synthetic applicant", async ({
    page,
  }) => {
    await page.goto("/admissions/enquire/demo-enquiry-2026");
    await expect(
      page.getByRole("heading", { name: "Admission enquiry" }),
    ).toBeVisible();
    await page
      .getByLabel(/Applicant name/)
      .fill(`Synthetic Browser Applicant ${Date.now()}`);
    await page
      .getByLabel("Email address")
      .fill(`browser.admission.${Date.now()}@example.test`);
    await page
      .getByLabel(/Parent or guardian name/)
      .fill("Synthetic Browser Guardian");
    await page.getByLabel(/Preferred contact method/).selectOption("Email");
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(
      page.getByRole("heading", { name: "Thank you" }),
    ).toBeVisible();
    await expect(page.getByText(/Reference:/)).toBeVisible();
  });

  test("requires authentication for the internal admissions pipeline", async ({
    page,
  }) => {
    await page.goto("/admissions");
    await expect(page).toHaveURL(/\/sign-in\?returnUrl=/);
  });

  test("an authorised school administrator can view funnel, seats, and applications", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const password = process.env.DEMO_USER_PASSWORD;
    test.skip(
      !password,
      "DEMO_USER_PASSWORD is required for the seeded admissions journey",
    );
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill("school-admin@demo.nasaq.test");
    await page.getByLabel("Password").fill(password ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/admissions");
    await expect(
      page.getByRole("heading", { name: "Admissions pipeline" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Funnel" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Seat availability" }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });
});
