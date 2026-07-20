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
  await expect(
    page.getByRole("heading", { name: "Spending", exact: true })
  ).toBeVisible();

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
  await expect(page.getByText("OAKWOOD APARTMENTS RENT").first()).toBeVisible();
  // The sushi transaction's second-level label, scoped to its bucket section
  // (the dial breakdown inside the collapsed <details> also contains the text).
  await expect(
    page
      .getByRole("region", { name: "Guilt-Free Spending" })
      .getByText("Food & Dining")
  ).toBeVisible();
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
  // is created for the merchant. Picking the Money Dial IS the save — the
  // second-level chips swap in after the bucket tap, no separate button.
  await page.getByText("MYSTERY MERCHANT 4821").click();
  await page.getByRole("button", { name: "Guilt-Free", exact: true }).click();
  await page.getByRole("button", { name: "Convenience" }).click();
  await expect(page.getByText(/Convenience — saved, rule created/)).toBeVisible();
  // Drain the correction's in-flight write before reloading for the
  // server-rendered chip (a reload can abort a pending action — the #13
  // scenario), then poll: the refresh round trip is slow on the pooled
  // single connection.
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.reload();
    await expect(
      page.getByText("1 transaction not yet categorized ($45)")
    ).toBeVisible({ timeout: 12_000 });
  }).toPass({ timeout: 60_000 });

  // Month picker: the next (future) month has no data and the chip
  // disappears only because the count is genuinely zero.
  // A click during post-reload hydration can be swallowed — retry the
  // click until the navigation commits, then wait out the RSC stream
  // (the old month stays on screen until the new render arrives).
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByRole("link", { name: "Next month" }).click();
    await expect(page).toHaveURL(/month=/, { timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
  await expect(page.getByText("No feed transactions this month.")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("not yet categorized")).toHaveCount(0);
});

test("linked path: confidence-tiered Proposals on fixed-costs and debts steps", async ({
  page,
}) => {
  // The closing heartbeat wait reload-polls the one-truth Home read —
  // pace it generously (the read grew again with #86 and #89) instead of
  // letting the 90s default starve the final poll.
  test.setTimeout(240_000);

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  // --- Fixed-cost Proposals, tiered per the Proposal glossary entry.
  await page.goto("/dashboard/fixed-costs");
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
  await expect(
    page.getByRole("heading", { name: "Fixed Costs", exact: true })
  ).toBeVisible();
  await expect(page.getByText("Big enough to move the plan")).toHaveCount(0);

  // --- Debt Proposals: unmapped credit-card account, APR + minimum only.
  await page.goto("/dashboard/debts");
  await expect(
    page.getByText("Debts found in your linked accounts")
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("balance $350 (from the feed)")).toBeVisible();

  await page.getByLabel("APR (%)").fill("24.99");
  // exact + case-sensitive: the manual DebtEntryForm below has "Minimum Payment"
  await page.getByLabel("Minimum payment", { exact: true }).fill("35");
  await page.getByRole("button", { name: "Confirm Debt" }).click();

  // The confirmed Debt lands in the debts list with the feed-owned
  // balance. Drain the in-flight confirm first, then poll with reloads —
  // the list's one-time fetch can race the write (#13).
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.reload();
    await expect(page.getByText("Total Remaining Debt")).toBeVisible({
      timeout: 10_000,
    });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByText("E2E Card").first()).toBeVisible();

  // --- Income Proposals: always individually confirmed, never bundled.
  await page.goto("/dashboard/income");
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
  // Wait for the confirmation's server round-trip before navigating away —
  // the action is fired optimistically and a same-tick navigation can beat it.
  // Body-marker match: the confirm action's POST carries the merchant
  // pattern; a late hydration read also POSTs to this URL and must not
  // satisfy this wait.
  const confirmRoundTrip = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/dashboard/income") &&
      (response.request().postData() ?? "").includes("ACME CORP")
  );
  await page.getByRole("button", { name: "Confirm income" }).click();
  await confirmRoundTrip;
  // Appears twice once confirmed (regular income + effective monthly) —
  // both prove the proposal flowed into the CSP machinery like typed income.
  await expect(page.getByText("$11,500").first()).toBeVisible({
    timeout: 15_000,
  });

  // --- The heartbeat: with a confirmed income stream, the dashboard shows
  // the single Safe-to-Spend number with its Pay Period span. Drain the
  // in-flight writes first (the confirm action plus the 500ms-debounced
  // store persistence) — a full navigation would abort them; then poll with
  // reloads until the just-written decision is visible to the card's
  // one-time fetch.
  await page.waitForLoadState("networkidle");
  await page.goto("/dashboard");
  await expect(async () => {
    await page.reload();
    // Full card only: the empty state says "Pay Periods are…", never
    // "Pay Period <Mon> <day>".
    // Each attempt reloads (aborting the in-flight one-read), so the
    // inner wait must outlast a full getHomeTruth round trip on the
    // pooled single connection (#79 made Home's read heavier; #86 and
    // #89 heavier still — an aborted read's zombie query chain also
    // queues ahead of the next attempt).
    await expect(page.getByText(/Pay Period [A-Z]/)).toBeVisible({
      timeout: 20_000,
    });
  }).toPass({ timeout: 120_000 });
  await expect(page.getByText("Safe-to-Spend")).toBeVisible();
  await expect(page.getByText(/paycheck −/)).toBeVisible();
});
