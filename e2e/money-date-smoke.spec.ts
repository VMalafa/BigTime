import { expect, test } from "@playwright/test";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

loadDotEnv();

// The Money Date (#81): payday raises it, four cards keep it, travel
// moves it — moved, never skipped. The fixture reseeds Dates every run.
test.skip(
  process.env.E2E_SEED_FIXTURE !== "1",
  "Money Date smoke needs the seeded fixture household: run with E2E_SEED_FIXTURE=1."
);

test.beforeEach(async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
});

test("payday raises the Date; travel shift moves it; timeline reads moved-not-skipped", async ({
  page,
}) => {
  // The Home glance raised it (paycheck detection) — the quiet banner.
  const banner = page.locator("[data-money-date-banner]");
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(banner).toContainText("Money Date is ready");

  // One-tap reschedule to a chosen evening.
  await banner.click();
  await expect(page).toHaveURL(/\/dashboard\/money-date/);
  const evening = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  await page.getByLabel("Move to evening").fill(evening);
  await page.getByRole("button", { name: "Move it" }).click();

  // Back Home: the banner now says where it went.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(page.locator("[data-money-date-banner]")).toContainText(
    "waiting for you both",
    { timeout: 20_000 }
  );

  // The Timeline renders the moved Date on its chosen evening.
  await page.goto("/dashboard/timeline");
  const movedMoment = page
    .locator('[data-timeline-kind="money_date"]')
    .filter({ hasText: "moved, never skipped" });
  await expect(movedMoment).toBeVisible({ timeout: 20_000 });
});

test("seven cards (first of month) to kept in ≤10 taps; archive holds the Date and the Check-In pre-history", async ({
  page,
}) => {
  await page.goto("/dashboard/money-date");

  // Card 1: Weather recap — a real state word, live-derived. The fixture
  // Date is the month's first (rows reseed every run), so the deep agenda
  // (#82) joins: 7 cards, "1 of 7".
  const first = page.locator("[data-date-card='weather']");
  await expect(first).toBeVisible({ timeout: 20_000 });
  await expect(first).toContainText("1 of 7");
  await expect(first.getByRole("heading")).toHaveText(
    /Steady|Watch|Attention/
  );
  // Clicks scope to the visible card — during the exit animation the
  // outgoing card's buttons are still in the DOM.
  await first.getByRole("button", { name: "Next" }).click(); // tap 1

  // Card 2: one insight, derived from last month's movement.
  const insight = page.locator("[data-date-card='insight']");
  await expect(insight).toBeVisible();
  await insight.getByRole("button", { name: "Next" }).click(); // tap 2

  // Card 3: one next action (the Weather engine's, or "enjoy it").
  const action = page.locator("[data-date-card='action']");
  await expect(action).toBeVisible();
  await action.getByRole("button", { name: "Next" }).click(); // tap 3

  // Deep card 1: Dial Drift — honest suppression on thin data (the
  // fixture's prior month carries no dialed guilt-free rows), no shame,
  // and the counselor door.
  const drift = page.locator("[data-date-card='drift']");
  await expect(drift).toBeVisible();
  await expect(drift).toContainText("No verdicts on thin data");
  await expect(
    drift.getByRole("link", { name: /talk this through/ })
  ).toHaveAttribute("href", /partner\/counselor\?topic=/);
  await drift.getByRole("button", { name: "Next" }).click(); // tap 4

  // Deep card 2: the CSP tune-up — confirm-and-move-on.
  const csp = page.locator("[data-date-card='csp']");
  await expect(csp).toBeVisible();
  await csp.getByRole("button", { name: /Looks right — Next/ }).click(); // tap 5

  // Deep card 3: subscription audit — the seeded Netflix pattern shows;
  // choosing investigate becomes the Date's one next action.
  const audit = page.locator("[data-date-card='audit']");
  await expect(audit).toBeVisible();
  await expect(audit).toContainText("Netflix Com");
  await audit.getByRole("button", { name: "investigate" }).first().click(); // tap 6
  await audit.getByRole("button", { name: "Next", exact: true }).click(); // tap 7

  // Closing card: always the Goal — the invitation, never an error.
  const goal = page.locator("[data-date-card='goal']");
  await expect(goal).toBeVisible();
  await expect(goal).toContainText("Pick the goal this is all for");
  await goal.getByRole("button", { name: "Finish the Date" }).click(); // tap 8

  // Finish: the chosen investigation is the one next action; default
  // present chip stands → kept. Tap 9 of ≤10.
  await expect(
    page.getByText(/Investigate Netflix Com/).first()
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark it kept" }).click();
  await expect(page.locator("[data-date-card='kept']")).toBeVisible({
    timeout: 20_000,
  });

  // The archive shows the kept Date and the read-only pre-history.
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Money Date archive" })
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/kept/).first()).toBeVisible();
  await expect(
    page.getByText("E2E pre-history: stayed under on groceries.")
  ).toBeVisible();

  // Home lets go of the banner — the Date is kept.
  await page.goto("/dashboard");
  await expect(page.getByText("Safe-to-Spend")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("[data-money-date-banner]")).toHaveCount(0);
});
