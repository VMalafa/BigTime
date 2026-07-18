import { expect, test } from "@playwright/test";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

loadDotEnv();

// Household Timeline v1 (#56): seeded school Events and the money rhythm
// derived from seeded feed data render as one merged stream. Needs the
// seeded fixture household (global-setup seeds the school Calendar Source,
// the pre-confirmed paycheck stream, and the utility Earmark fixture).
test.skip(
  process.env.E2E_SEED_FIXTURE !== "1",
  "Timeline smoke needs the seeded fixture household: run with E2E_SEED_FIXTURE=1 (writes an isolated e2e-spending-* household to the shared DB)."
);

test("merged stream: school events + money rhythm interleaved; drafts and dismissed never render", async ({
  page,
}) => {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  // Peer-surface nav entry.
  await expect(
    page.getByRole("link", { name: "Timeline" }).first()
  ).toBeVisible();

  await page.goto("/dashboard/timeline");
  await expect(
    page.getByRole("heading", { name: "Household Timeline" })
  ).toBeVisible();

  // The Sunday scan: school quirks and the money rhythm in one stream.
  await expect(page.getByText("Noon Dismissal – E2E School")).toBeVisible();
  await expect(page.getByText("E2E School Holiday")).toBeVisible();
  await expect(
    page.locator('[data-timeline-kind="payday"]').first()
  ).toBeVisible();
  await expect(
    page.locator('[data-timeline-kind="money_date"]').first()
  ).toBeVisible();

  // Earmark due date from the seeded utility stream, covered-by-default:
  // settled rhythm naming the paycheck, never a warning.
  const earmark = page.locator('[data-timeline-kind="earmark_due"]').first();
  await expect(earmark).toBeVisible();
  await expect(earmark).toContainText("Ete Utility Coop");
  await expect(earmark).toContainText(/Covered by/);

  // DRAFT and DISMISSED Events never render on the timeline.
  await expect(page.getByText("E2E Draft Only Event")).toHaveCount(0);
  await expect(page.getByText("E2E Dismissed Only Event")).toHaveCount(0);

  // Money moments are derived live, never stored as Events: dismissing the
  // rhythm chips empties them while school events stay.
  await page.getByRole("button", { name: "Paydays" }).click();
  await page.getByRole("button", { name: "Due dates" }).click();
  await page.getByRole("button", { name: "Money Dates" }).click();
  await expect(page.locator('[data-timeline-kind="payday"]')).toHaveCount(0);
  await expect(
    page.locator('[data-timeline-kind="earmark_due"]')
  ).toHaveCount(0);
  await expect(page.getByText("Noon Dismissal – E2E School")).toBeVisible();

  // Per-source category chip: muting "dismissal" hides the dismissal but
  // keeps the holiday.
  await page.getByRole("button", { name: "dismissal", exact: true }).click();
  await expect(page.getByText("Noon Dismissal – E2E School")).toHaveCount(0);
  await expect(page.getByText("E2E School Holiday")).toBeVisible();
});
