import { expect, test } from "@playwright/test";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

loadDotEnv();

// The one-truth Home (#77): Weather hero + Safe-to-Spend + honest chip +
// the "where did it go" door, and nothing else. The exact Weather word
// depends on where "today" falls in the fixture's pay rhythm, so the smoke
// asserts the structural contract (a word renders; non-Steady carries one
// action) — the rule branches themselves are pinned by unit tests.
test.skip(
  process.env.E2E_SEED_FIXTURE !== "1",
  "Home smoke needs the seeded fixture household: run with E2E_SEED_FIXTURE=1 (writes an isolated e2e-spending-* household to the shared DB)."
);

test("home renders hero + heartbeat + honest chip + door, and nothing else", async ({
  page,
}) => {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  // --- The Weather hero: one of the three ratified words, as an h1.
  const hero = page.locator("[data-weather-state]");
  await expect(hero).toBeVisible({ timeout: 15_000 });
  const state = await hero.getAttribute("data-weather-state");
  expect(["Steady", "Watch", "Attention"]).toContain(state);
  await expect(page.getByRole("heading", { name: state!, exact: true })).toBeVisible();

  // Non-Steady shows exactly one action link inside the hero; Steady none.
  const actions = hero.getByRole("link");
  if (state === "Steady") {
    await expect(actions).toHaveCount(0);
  } else {
    await expect(actions).toHaveCount(1);
  }

  // --- Safe-to-Spend with its Pay Period span.
  await expect(page.getByText("Safe-to-Spend").first()).toBeVisible();
  await expect(page.getByText(/Pay Period [A-Z]/)).toBeVisible();

  // --- The honest chip: the fixture seeds exactly two current-month
  // uncategorized outflows (transfers excluded), linking into Spending.
  const chip = page.getByRole("link", {
    name: /2 transactions not yet categorized/,
  });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("href", "/dashboard/spending");

  // --- The "where did it go" door.
  await expect(
    page.getByRole("link", { name: /where did it go/ })
  ).toBeVisible();

  // --- Nothing else: the killed widgets stay gone (#25/#27).
  await expect(page.getByText("Debt Summary")).toHaveCount(0);
  await expect(page.getByText("Monthly Income")).toHaveCount(0);
  await expect(page.getByText("Credit Health")).toHaveCount(0);
  await expect(page.getByText("Conscious Spending Plan")).toHaveCount(0);
});
