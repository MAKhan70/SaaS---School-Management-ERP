import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);
const administratorEmail = `administrator-${runId}@example.test`;
const administratorPassword = "FictionalAdmin123";

test("unauthenticated access is redirected to sign in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in\?returnUrl=/);
  await expect(
    page.getByRole("heading", { name: "Sign in to your workspace" }),
  ).toBeVisible();
});

test("a tenant administrator completes onboarding", async ({ page }) => {
  await page.goto("/onboarding");
  await page
    .getByLabel("Educational trust name")
    .fill(`Fictional Learning Trust ${runId}`);
  await page
    .getByLabel("Trust URL identifier")
    .fill(`fictional-learning-${runId}`);
  await page.getByLabel("Primary school name").fill("Fictional Public School");
  await page.getByLabel("School code").fill("FPS");
  await page.getByLabel("First campus name").fill("Central Campus");
  await page.getByLabel("Campus code").fill("CENTRAL");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Academic year name").fill("Academic Year 2026–27");
  await page.getByLabel("Academic year code").fill("AY-2026-27");
  await page.getByLabel("Starts on").fill("2026-04-01");
  await page.getByLabel("Ends on").fill("2027-03-31");
  await page.getByLabel("Board", { exact: true }).selectOption("CBSE");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Full name").fill("Fictional Administrator");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(administratorEmail);
  await page
    .getByLabel("Password", { exact: true })
    .fill(administratorPassword);
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByLabel("Staff email addresses")
    .fill(`teacher-${runId}@example.test`);
  await page.getByRole("button", { name: "Complete onboarding" }).click();
  await expect(page).toHaveURL(/\/sign-in\?onboarded=true/);
});

test("administrator signs in, sees context, signs out, and loses access", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(administratorEmail);
  await page.getByLabel("Password").fill(administratorPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByLabel("School context")).toHaveValue(/.+/);
  await page.getByLabel("Open user menu").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in\?returnUrl=/);
});

test("administrator can open the responsive school setup workspace", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(administratorEmail);
  await page.getByLabel("Password").fill(administratorPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/school-setup");
  await expect(
    page.getByRole("heading", {
      name: "School setup and academic structure",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Configuration inventory" }),
  ).toBeVisible();
  await expect(
    page.getByText("Board configuration version", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", {
      name: "School setup and academic structure",
    }),
  ).toBeVisible();
});

test("password reset initiation never reveals account existence", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("not-present@example.test");
  await page.getByRole("button", { name: "Send reset instructions" }).click();
  await expect(
    page.getByText("If an eligible account matches that address"),
  ).toBeVisible();
});
