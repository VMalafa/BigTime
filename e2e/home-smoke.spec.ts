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
  await expect(hero).toBeVisible({ timeout: 30_000 });
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

// #79: the Today strip + cross-domain Weather targeting. The fixture
// seeds an unassigned "dismissal" Event tomorrow, so coverage Watch is
// deterministic; assigning it flips the hero per engine rules.
test("today strip: quirk row + coverage Watch; assignment flips the hero", async ({
  page,
}) => {
  // Three full Home reads plus a timeline reload-poll — the 90s default
  // starves the closing visit (#79/#86/#89 all grew the one-read).
  test.setTimeout(240_000);

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  // Coverage outranks money: the hero is Watch with the pickup action.
  const hero = page.locator("[data-weather-state]");
  await expect(hero).toBeVisible({ timeout: 30_000 });
  await expect(hero).toHaveAttribute("data-weather-state", "Watch");
  await expect(hero).toContainText(
    "E2E Pickup Quirk – Tomorrow tomorrow — no one's on pickup yet."
  );
  const action = hero.getByRole("link", { name: /Assign pickup/ });
  await expect(action).toBeVisible();
  await expect(action).toHaveAttribute("href", "/dashboard/timeline");

  // The strip: tomorrow's row in month-river anatomy with the quiet-loud
  // pickup flag; the label carries the date.
  const strip = page.locator("[data-today-strip]");
  await expect(strip.getByText(/Tomorrow ·/)).toBeVisible();
  const quirkRow = strip
    .locator("[data-strip-row='event']")
    .filter({ hasText: "E2E Pickup Quirk – Tomorrow" });
  await expect(quirkRow).toBeVisible();
  await expect(quirkRow).toContainText("who's got pickup?");

  // Assign it on the Timeline (two taps, #72)...
  await page.goto("/dashboard/timeline");
  const card = page
    .locator('[data-timeline-kind="event"]')
    .filter({ hasText: "E2E Pickup Quirk – Tomorrow" });
  await card
    .getByRole("button", { name: "Assign E2E Pickup Quirk – Tomorrow" })
    .click();
  await card
    .getByRole("group")
    .getByRole("button", { name: "Sitter", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: /assigned to Sitter/ })
  ).toBeVisible();

  // The chip render above is optimistic; wait for SERVER truth on the
  // timeline first (poll with reloads — the #13 race), so the Home visit
  // below reads a world where the assignment already exists.
  await expect(async () => {
    await page.reload();
    await expect(
      card.getByRole("button", { name: /assigned to Sitter/ })
    ).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });

  // ...and the hero lets go of it. Poll with reloads — the one-read is a
  // heavy query chain on a single pooled connection, and it can queue
  // behind reads the reload-poll above aborted mid-flight.
  await page.goto("/dashboard");
  await expect(async () => {
    await page.reload();
    await expect(page.locator("[data-weather-state]")).toBeVisible({
      timeout: 20_000,
    });
  }).toPass({ timeout: 90_000 });
  await expect(
    page.locator("[data-weather-state]").getByRole("link", {
      name: /Assign pickup/,
    })
  ).toHaveCount(0);

  // The strip row now carries the chip instead of the question.
  const assignedRow = page
    .locator("[data-strip-row='event']")
    .filter({ hasText: "E2E Pickup Quirk – Tomorrow" });
  await expect(assignedRow).toContainText("Sitter");
  await expect(assignedRow).not.toContainText("who's got pickup?");
});
