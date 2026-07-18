import { expect, test } from "@playwright/test";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

loadDotEnv();

// Nav end-state (#60): exactly Home · Timeline · Spending · Plan on desktop
// and mobile; Credit and Automation absent from nav but their routes still
// resolve (Automation via Settings); the Plan section reaches its sub-views.
test.skip(
  process.env.E2E_SEED_FIXTURE !== "1",
  "Nav smoke needs the seeded fixture household: run with E2E_SEED_FIXTURE=1 (writes an isolated e2e-spending-* household to the shared DB)."
);

test("nav renders the four tabs; Plan reaches its sub-views; unlinked routes resolve", async ({
  page,
}) => {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  // --- Desktop sidebar: exactly the four tabs, in order.
  const sidebar = page.locator("aside nav");
  await expect(sidebar.getByRole("link")).toHaveText([
    "Home",
    "Timeline",
    "Spending",
    "Plan",
  ]);

  // --- Mobile tab bar: the same four.
  await page.setViewportSize({ width: 390, height: 844 });
  const tabBar = page.locator("nav.md\\:hidden");
  await expect(tabBar.getByRole("link")).toHaveText([
    "Home",
    "Timeline",
    "Spending",
    "Plan",
  ]);
  await page.setViewportSize({ width: 1280, height: 720 });

  // --- Plan section reaches income, debts, fixed costs, CSP, dials.
  await page.goto("/dashboard/plan");
  await expect(
    page.getByRole("heading", { name: "Plan", exact: true })
  ).toBeVisible();
  for (const area of [
    "Income",
    "Debts",
    "Fixed Costs",
    "Conscious Spending Plan",
    "Money Dials",
  ]) {
    await expect(
      page.getByRole("link", { name: new RegExp(area) })
    ).toBeVisible();
  }
  await page.getByRole("link", { name: /^Income/ }).click();
  await expect(
    page.getByRole("heading", { name: "Income Planning" })
  ).toBeVisible();

  // --- Credit keeps its route without a nav slot.
  await page.goto("/dashboard/credit");
  await expect(
    page.getByRole("heading", { name: "Credit Improvement Strategy" })
  ).toBeVisible();

  // --- Automation is reachable from Settings, which launches from Home.
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/dashboard\/settings/);
  await page.getByRole("link", { name: "Automation & Next Steps" }).click();
  await expect(page).toHaveURL(/\/dashboard\/automation/);
  await expect(
    page.getByRole("heading", { name: "Automation & Next Steps" })
  ).toBeVisible();
});
