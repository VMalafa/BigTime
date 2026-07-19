import { expect, test } from "@playwright/test";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

loadDotEnv();

// Bonus Plan & Bonus Moment (#89). The fixture seeds, against a confirmed
// $1,500-typical paycheck stream:
//   · E2E SPOT BONUS PAYOUT  $900 (0.6×)  -> must raise a Moment
//   · E2E SMALL REBATE       $400 (0.27×) -> must stay silent
//   · ACME CORP PAYROLL    $6,000 one-off -> a second legitimate windfall
// plus one unresolved pre-#89 BonusItem for the one-time migration card.
// Detection idempotency, split math, and Safe-to-Spend exclusion are
// pinned by unit tests; this smoke walks the surfaces.
test.skip(
  process.env.E2E_SEED_FIXTURE !== "1",
  "Bonus smoke needs the seeded fixture household: run with E2E_SEED_FIXTURE=1."
);

test.describe.configure({ mode: "serial" });

test("the Moment card: oldest windfall first, split in real dollars, decisions stick", async ({
  page,
}) => {
  // Cold Home reads on the dev server can exceed 10s — pace generously.
  test.setTimeout(240_000);

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  // --- The oldest Moment first: the $900 spot bonus (last month) beats
  // the $6,000 one-off (this month). The $400 rebate never appears.
  // First spec of the suite — the coldest Home read gets the most room.
  const moment = page.locator("[data-bonus-moment]");
  await expect(moment).toBeVisible({ timeout: 30_000 });
  await expect(moment).toContainText("$900.00");
  await expect(moment).toContainText("E2E SPOT BONUS PAYOUT");
  // The ratified 70/15/15 default in real dollars: 630 / 135 / 135.
  await expect(moment).toHaveAttribute("data-bonus-split", "63000/13500/13500");
  await expect(moment).toContainText("$630.00");
  await expect(moment).toContainText("$135.00");

  // --- Confirm is one calm decision; the next Moment (the $6,000 one-off)
  // steps up after the refetch.
  await moment.getByRole("button", { name: "Confirm the plan" }).click();
  await expect(moment).toContainText("$6,000.00", { timeout: 20_000 });
  await expect(moment).toHaveAttribute(
    "data-bonus-split",
    "420000/90000/90000"
  );

  // --- "Not a windfall" dismisses quietly — and saying no sticks: a
  // reload re-runs detection, both decided Moments stay decided, and the
  // $400 rebate never raised one (dedup by deposit id). The hide is
  // optimistic, so prove server truth with a reload — re-tapping only if
  // the dismiss write was dropped (the #13 race, write edition).
  await expect(async () => {
    const card = page.locator("[data-bonus-moment]");
    if ((await card.count()) > 0) {
      const dismiss = card.getByRole("button", { name: "not a windfall" });
      if (await dismiss.isVisible()) {
        await dismiss.click();
        await page.waitForLoadState("networkidle");
      }
    }
    await page.reload();
    await expect(page.locator("[data-weather-state]")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("[data-bonus-moment]")).toHaveCount(0);
  }).toPass({ timeout: 120_000 });
});

test("the migration card surfaces a legacy BonusItem exactly once", async ({
  page,
}) => {
  test.setTimeout(240_000);

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  await page.goto("/dashboard/income");
  const migration = page.locator("[data-bonus-migration]");
  await expect(migration).toBeVisible({ timeout: 20_000 });
  await expect(migration).toContainText("E2E Legacy Retention Bonus");
  // $2,000 gross at 35% -> ~$1,300 net.
  await expect(migration).toContainText("$1,300");

  // Let it go: the row resolves and the card empties for good.
  await migration.getByRole("button", { name: "Let it go" }).click();
  await expect(migration).toHaveCount(0, { timeout: 20_000 });

  // Reload — resolved means resolved; the card must not return.
  await page.reload();
  await expect(page.locator("[data-bonus-fallback]")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("[data-bonus-migration]")).toHaveCount(0);
});

test("the Bonus Plan editor lives at the Plan step with the default pre-filled", async ({
  page,
}) => {
  test.setTimeout(240_000);

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  await page.goto("/dashboard/spending-plan");
  const card = page.locator("[data-bonus-plan]");
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByLabel("Target debt")).toHaveValue("70");
  await expect(card.getByLabel("Spotlight Goal")).toHaveValue("15");
  await expect(card.getByLabel("Guilt-free")).toHaveValue("15");

  // Validation to 100: nudge one field and watch the save gate close.
  await card.getByLabel("Target debt").fill("60");
  await expect(card).toContainText("must total 100%");
  await expect(
    card.getByRole("button", { name: "Save the split" })
  ).toBeDisabled();

  // Back to a valid split routed differently — save is one awaited intent.
  await card.getByLabel("Spotlight Goal").fill("25");
  await card.getByRole("button", { name: "Save the split" }).click();
  await expect(card).toContainText("Saved —", { timeout: 20_000 });
});
