import { expect, test } from "@playwright/test";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

loadDotEnv();

// Renewal radar (#70): feed-derived drafts + the two styling moments.
test.skip(
  process.env.E2E_SEED_FIXTURE !== "1",
  "Renewal smoke needs the seeded fixture household: run with E2E_SEED_FIXTURE=1."
);

test.beforeEach(async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
});

test("feed-derived draft: the seeded annual insurance charge raises a renewal a year out", async ({
  page,
}) => {
  // Loading the review surface runs the radar's draft derivation.
  await page.goto("/dashboard/calendar");
  const feedDerived = page.getByRole("region", { name: "Feed-derived" });
  await expect(feedDerived).toBeVisible({ timeout: 20_000 });
  await expect(feedDerived).toContainText(
    "Acme Insurance Annual Premium renewal"
  );
  // A draft to ratify — never auto-confirmed — carrying the premium.
  await expect(
    feedDerived.getByRole("button", { name: /Confirm all/ })
  ).toBeVisible();
  await expect(feedDerived).toContainText("$1,285");
});

test("lead-time states: one loud escalation, quiet siblings, Done quiets immediately", async ({
  page,
}) => {
  await page.goto("/dashboard/timeline");

  // The soonest escalated renewal is the only loud one (no stacking);
  // its card carries the one next action.
  const loud = page.locator("[data-renewal-state='escalated-loud']");
  await expect(loud).toHaveCount(1, { timeout: 20_000 });
  await expect(loud).toContainText("E2E Insurance Renewal");
  await expect(loud).toContainText(/Renews in \d+ days/);

  // The second escalated renewal holds the quiet style; the 20-day one
  // reads as upcoming.
  const quietEscalated = page.locator("[data-renewal-state='escalated']");
  await expect(quietEscalated).toContainText("E2E Second Renewal");
  await expect(
    page.locator("[data-renewal-state='upcoming']")
  ).toContainText("E2E Warranty Renewal");

  // Done: quiets optimistically, and the next escalated renewal takes the
  // loud slot — still exactly one.
  await loud.getByRole("button", { name: "Done" }).click();
  await expect(
    page
      .locator("[data-renewal-state='handled']")
      .filter({ hasText: "E2E Insurance Renewal" })
  ).toBeVisible();
  await expect(
    page.locator("[data-renewal-state='escalated-loud']")
  ).toHaveCount(1);
  await expect(
    page.locator("[data-renewal-state='escalated-loud']")
  ).toContainText("E2E Second Renewal");

  // The handled state survived the awaited action: reload shows it from
  // server truth (poll — the write races a same-tick reload, #13).
  await expect(async () => {
    await page.reload();
    await expect(
      page
        .locator("[data-renewal-state='handled']")
        .filter({ hasText: "E2E Insurance Renewal" })
    ).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });

  // Dismiss the now-loud second renewal: it leaves the timeline.
  const secondLoud = page.locator("[data-renewal-state='escalated-loud']");
  await expect(secondLoud).toContainText("E2E Second Renewal");
  await secondLoud.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("E2E Second Renewal")).toHaveCount(0);
});
