import { expect, test } from "@playwright/test";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

// Signed-in smoke for /dashboard/spending against the seeded fixture
// household (see global-setup.ts): plan-vs-actual buckets, the honest
// uncategorized chip, and Transfers excluded everywhere.

loadDotEnv();

// Requires the seeded fixture household (global-setup with E2E_SEED_FIXTURE=1
// — a deliberate write to the shared database that needs human authorization).
// Without it this spec skips loudly instead of failing or silently passing.
test.skip(
  process.env.E2E_SEED_FIXTURE !== "1",
  "Signed-in spending smoke needs the seeded fixture household: run with E2E_SEED_FIXTURE=1 (writes an isolated e2e-spending-* household to the shared DB)."
);

test("spending page: plan vs actual, honest chip, Transfers excluded", async ({
  page,
}) => {
  // Sign in through the real login form.
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  await page.goto("/dashboard/spending");
  await expect(page.getByRole("heading", { name: "Spending" })).toBeVisible();

  // Honesty chip: exactly the two uncategorized money-out transactions
  // ($60 + $45); the Transfer legs and the paycheck deposit don't count.
  await expect(
    page.getByText("2 transactions not yet categorized ($105)")
  ).toBeVisible();

  // Plan vs actual: income $6,000 from the feed; Fixed Costs plan 50%,
  // actual $1,800 -> 30%.
  await expect(page.getByText("of $6,000 income this month")).toBeVisible();
  const fixedCosts = page.locator('[data-bucket="FIXED_COSTS"]');
  await expect(fixedCosts).toContainText("plan 50%");
  await expect(fixedCosts).toContainText("actual 30% ($1,800)");
  const guiltFree = page.locator('[data-bucket="GUILT_FREE"]');
  await expect(guiltFree).toContainText("plan 30%");
  await expect(guiltFree).toContainText("actual 2% ($120)");

  // Grouped transaction list with merchants and second-level categories.
  await expect(page.getByText("OAKWOOD APARTMENTS RENT")).toBeVisible();
  await expect(page.getByText("Food & Dining")).toBeVisible();
  await expect(page.getByText("MYSTERY MERCHANT 4821")).toBeVisible();

  // Transfers appear only in their own excluded section, never as spending.
  const transfersSection = page.getByRole("region", { name: "Transfers" });
  await expect(transfersSection.getByText("E2E PAYMENT TO CARD")).toBeVisible();

  // Dial Drift: with a single dial-categorized guilt-free transaction the
  // callout is honestly suppressed, and the breakdown reconciles (100% to
  // Food & Dining).
  await expect(page.getByText("Dial Drift needs at least")).toBeVisible();
  await page
    .getByText("Money Dials — where guilt-free actually went")
    .click();
  await expect(
    page.getByText("Food & Dining · importance 5/10")
  ).toBeVisible();

  // Inline Correction: recategorize an uncategorized merchant; the honest
  // chip recounts (only SQ *CORNER STORE, $45, remains) and a standing rule
  // is created for the merchant.
  await page.getByText("MYSTERY MERCHANT 4821").click();
  await page.getByRole("button", { name: "Guilt-Free", exact: true }).click();
  await page.getByRole("button", { name: "Convenience" }).click();
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(
    page.getByText("1 transaction not yet categorized ($45)")
  ).toBeVisible({ timeout: 15_000 });

  // Month picker: the next (future) month has no data and the chip
  // disappears only because the count is genuinely zero.
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page.getByText("No feed transactions this month.")).toBeVisible();
  await expect(page.getByText("not yet categorized")).toHaveCount(0);
});

test("linked path: confidence-tiered Proposals on fixed-costs and debts steps", async ({
  page,
}) => {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  // --- Fixed-cost Proposals, tiered per the Proposal glossary entry.
  await page.goto("/flow/fixed-costs");
  await expect(
    page.getByText("Proposals from your linked accounts")
  ).toBeVisible({ timeout: 20_000 });

  // Netflix: clear-cut monthly subscription -> confirm-all tier.
  await expect(page.getByText("Netflix Com")).toBeVisible();
  // Rent: $1,800/mo on $6,000 income -> plan-moving, individual tier.
  await expect(page.getByText("Big enough to move the plan")).toBeVisible();

  // Confirm-all creates real line items (visible in the list below).
  await page.getByRole("button", { name: /Confirm all/ }).click();
  await expect(
    page.getByText("Netflix Com").first()
  ).toBeVisible();

  // Dismissal is remembered: dismiss the rent Proposal, reload, gone.
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.reload();
  await expect(page.getByText("What's actually locked in?")).toBeVisible();
  await expect(page.getByText("Big enough to move the plan")).toHaveCount(0);

  // --- Debt Proposals: unmapped credit-card account, APR + minimum only.
  await page.goto("/flow/debts");
  await expect(
    page.getByText("Debts found in your linked accounts")
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("balance $350 (from the feed)")).toBeVisible();

  await page.getByLabel("APR (%)").fill("24.99");
  await page.getByLabel("Minimum payment").fill("35");
  await page.getByRole("button", { name: "Confirm Debt" }).click();

  // The confirmed Debt lands in the debts list with the feed-owned balance.
  await expect(page.getByText("Total Debt")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("E2E Card").first()).toBeVisible();

  // --- Income Proposals: always individually confirmed, never bundled.
  await page.goto("/flow/income");
  await expect(
    page.getByText("Income found in your linked accounts")
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Acme Corp Des Payroll")).toBeVisible();
  await expect(page.getByText("$5,500/mo")).toBeVisible();
  await expect(page.getByText("Deposit evidence (6 seen)")).toBeVisible();
  // No confirm-all exists for income, by design.
  await expect(page.getByRole("button", { name: /Confirm all/ })).toHaveCount(0);

  // Confirmed income feeds the CSP machinery like typed income:
  // $6,000 existing + $5,500 derived = $11,500 effective monthly.
  await page.getByRole("button", { name: "Confirm income" }).click();
  await expect(page.getByText("$11,500/mo")).toBeVisible({ timeout: 15_000 });
});
