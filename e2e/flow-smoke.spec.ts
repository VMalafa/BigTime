import { expect, test } from "@playwright/test";

// Smoke test for the anonymous Conscious Spending Plan flow:
// income -> fixed costs -> spending plan. State lives in localStorage only,
// so no auth or database is required.
test("anonymous flow: income to fixed costs to spending plan", async ({
  page,
}) => {
  // --- Income ---
  await page.goto("/flow/income");
  await page.getByLabel("Income Source").fill("Salary");
  await page.getByLabel("Monthly Amount").fill("6000");
  await page.getByRole("button", { name: "Add Income" }).click();

  await expect(page.getByText("Effective monthly")).toBeVisible();
  await expect(page.getByText("$6,000").first()).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/flow\/fixed-costs/);

  // --- Fixed costs ---
  await page.getByLabel("Line item name").fill("Rent");
  await page.getByLabel("Monthly amount").fill("1800");
  await page.getByRole("button", { name: "Add line item" }).click();

  // Reality Check derives 1800 / 6000 = 30%
  await expect(page.getByText("Derived Fixed Costs %")).toBeVisible();
  await expect(page.getByText("30%").first()).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/flow\/spending-plan/);

  // --- Spending plan ---
  await expect(
    page.getByText("Your Conscious Spending Plan")
  ).toBeVisible();
  // The Fixed Costs slider is pre-seeded from the derived 30%
  await expect(page.getByText("Derived Fixed Costs %")).toBeVisible();
  await expect(page.getByText("30%").first()).toBeVisible();
});
