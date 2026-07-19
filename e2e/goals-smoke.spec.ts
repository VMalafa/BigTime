import { expect, test } from "@playwright/test";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

loadDotEnv();

// Goals v1 (#86): feed-owned progress, the Spotlight slice in the
// heartbeat, one-at-a-time Milestone celebrations, the Timeline horizon,
// and the two-tap Spotlight switch.
test.skip(
  process.env.E2E_SEED_FIXTURE !== "1",
  "Goals smoke needs the seeded fixture household: run with E2E_SEED_FIXTURE=1."
);

test.beforeEach(async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
});

test("linked Goal: feed-owned progress, Spotlight slice in the heartbeat, horizon at the river's end", async ({
  page,
}) => {
  await page.goto("/dashboard/goals");

  // Create the dream, linked 1:1 to the seeded savings account — the feed
  // balance ($3,400 of $10,000) owns progress from the first render.
  await page.getByLabel("Goal name").fill("E2E Hawaii");
  await page.getByLabel("Emoji (optional)").fill("🌺");
  await page.getByLabel("Target ($)").fill("10000");
  await page
    .getByLabel("Savings account (optional)")
    .selectOption({ label: "E2E Savings ($3,400)" });
  await page.getByRole("button", { name: "Create Goal" }).click();

  const card = page.locator("[data-goal='E2E Hawaii']");
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText("34% funded");
  await expect(card).toContainText("tracked by E2E Savings");
  // The household's first Goal is the Spotlight by default.
  await expect(card).toContainText("Spotlight");

  // Set the slice; the heartbeat reserves it as an Earmark.
  await page.getByLabel("Slice per Pay Period ($)").fill("150");
  await page.getByRole("button", { name: "Set slice" }).click();
  await expect(page.getByLabel("Slice per Pay Period ($)")).toHaveValue(
    "150",
    { timeout: 20_000 }
  );

  await page.goto("/dashboard");
  await expect(page.getByText("Safe-to-Spend")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("E2E Hawaii slice")).toBeVisible();

  // The river always ends on the goal.
  await page.goto("/dashboard/timeline");
  await expect(page.locator("[data-timeline-horizon]")).toContainText(
    "🌺 E2E Hawaii · 34% funded",
    { timeout: 20_000 }
  );
});

test("Milestones celebrate one at a time, never re-raise; Spotlight switches in two taps", async ({
  page,
}) => {
  // Three prompt cycles, each a full Home read (heartbeat + detection)
  // on a cold dev-server render — the default 90s starves the third.
  test.setTimeout(240_000);

  // The 34%-funded Spotlight raised 10/20/30% Milestones on the Home
  // read — one prompt at a time, oldest first.
  const prompt = page.locator("[data-milestone-prompt]");
  await expect(prompt).toBeVisible({ timeout: 20_000 });
  await expect(prompt).toHaveCount(1);
  await expect(prompt).toContainText("E2E Hawaii is 10% funded");
  await prompt.getByRole("button", { name: /Celebrate it/ }).click();
  await expect(prompt).toHaveCount(0);
  // Drain the decide write before any reload — a same-tick navigation
  // aborts it (#13).
  await page.waitForLoadState("networkidle");

  // Decided is decided: the next one up is 20%, and 10% never returns.
  await expect(async () => {
    await page.reload();
    await expect(page.locator("[data-milestone-prompt]")).toContainText(
      "E2E Hawaii is 20% funded",
      // A cold render can exceed 10s; reloading sooner aborts the
      // in-flight Home read and the prompt never lands.
      { timeout: 20_000 }
    );
  }).toPass({ timeout: 90_000 });
  await page
    .locator("[data-milestone-prompt]")
    .getByRole("button", { name: "Not this one" })
    .click();
  await expect(page.locator("[data-milestone-prompt]")).toHaveCount(0);
  await page.waitForLoadState("networkidle");

  await expect(async () => {
    await page.reload();
    await expect(page.locator("[data-milestone-prompt]")).toContainText(
      "E2E Hawaii is 30% funded",
      // A cold render can exceed 10s; reloading sooner aborts the
      // in-flight Home read and the prompt never lands.
      { timeout: 20_000 }
    );
  }).toPass({ timeout: 90_000 });
  await page
    .locator("[data-milestone-prompt]")
    .getByRole("button", { name: "Not this one" })
    .click();
  await expect(page.locator("[data-milestone-prompt]")).toHaveCount(0);
  await page.waitForLoadState("networkidle");

  // The two-tap Spotlight switch: an unlinked second dream takes the
  // slice's seat, then Hawaii takes it back (the closing card and the
  // horizon follow the Spotlight).
  await page.goto("/dashboard/goals");
  await page.getByLabel("Goal name").fill("E2E Boat");
  await page.getByLabel("Target ($)").fill("5000");
  await page.getByRole("button", { name: "Create Goal" }).click();
  const boat = page.locator("[data-goal='E2E Boat']");
  await expect(boat).toBeVisible({ timeout: 20_000 });

  await boat.getByRole("button", { name: "Make Spotlight" }).click(); // tap 1
  await boat
    .getByRole("button", { name: /Confirm — the slice moves with it/ })
    .click(); // tap 2
  await expect(boat).toContainText("Spotlight", { timeout: 20_000 });

  const hawaii = page.locator("[data-goal='E2E Hawaii']");
  await hawaii.getByRole("button", { name: "Make Spotlight" }).click();
  await hawaii
    .getByRole("button", { name: /Confirm — the slice moves with it/ })
    .click();
  await expect(hawaii).toContainText("Spotlight", { timeout: 20_000 });
});
