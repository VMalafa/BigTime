import { expect, test } from "@playwright/test";
import {
  E2E_MANUAL_EMAIL,
  E2E_SPENDING_EMAIL,
  e2eManualPassword,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

loadDotEnv();

// Signup-first (#48): nothing renders anonymously. The retired /flow root
// bounces through Home to the login gate; the canonical pages and the
// side-quest pair gate the same way.
test("anonymous access redirects to the auth gate", async ({ page }) => {
  await page.goto("/flow");
  await expect(page).toHaveURL(/\/auth\/(signup|login)/);
  for (const path of ["/flow/money-type", "/flow/scripts"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/signup/);
  }
  for (const path of ["/dashboard/income", "/dashboard/spending-plan"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/(signup|login)/);
  }
});

// The One Flow's manual path (#73): a fresh household walks the canonical
// pages on manual fuel and finishes the moment Safe-to-Spend computes.
test.describe("manual-path walk", () => {
  test.skip(
    process.env.E2E_SEED_FIXTURE !== "1",
    "The manual walk needs the seeded manual fixture household: run with E2E_SEED_FIXTURE=1."
  );

  test("fresh household walks income → plan → dials to a real Safe-to-Spend", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(E2E_MANUAL_EMAIL);
    await page.getByLabel("Password").fill(e2eManualPassword());
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    // The walk banner is up; its finger points at Income (linking is
    // skippable — manual is the fallback, never a fork).
    const walk = page.locator("[data-setup-walk]");
    await expect(walk).toBeVisible({ timeout: 20_000 });
    await expect(walk.getByText("Link accounts")).toBeVisible();
    await page.getByRole("link", { name: "Continue setup →" }).click();
    await expect(page).toHaveURL(/\/dashboard\/income/);

    // Manual fuel: one income source.
    await page.getByLabel("Income Source").fill("E2E Manual Salary");
    await page.getByLabel("Monthly Amount").fill("6000");
    const addRoundTrip = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        (response.request().postData() ?? "").includes("E2E Manual Salary")
    );
    await page.getByRole("button", { name: "Add Income" }).click();
    await expect(page.getByText("E2E Manual Salary")).toBeVisible();
    await addRoundTrip;

    // The walk's finger moves to Plan & Dials → the CSP page first.
    await page.goto("/dashboard/spending-plan");
    await expect(
      page.getByRole("heading", { name: "Conscious Spending Plan" })
    ).toBeVisible({ timeout: 20_000 });
    // Reach 100% via the flexible-bucket balancer if needed, then save.
    const balance = page.getByRole("button", {
      name: "Balance remaining across flexible buckets",
    });
    if (await balance.isVisible().catch(() => false)) {
      await balance.click();
    }
    const saveRoundTrip = page.waitForResponse(
      (response) => response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Save plan" }).click();
    await saveRoundTrip;
    await expect(page.getByText("Plan saved.")).toBeVisible({
      timeout: 20_000,
    });

    // Name a Dial (the debounced per-dial save fires after the hand
    // settles); drain it before navigating.
    await page.goto("/dashboard/money-dials");
    const firstDial = page.locator('input[type="range"]').first();
    await expect(firstDial).toBeVisible({ timeout: 20_000 });
    // The sliders are visible in the server HTML before React hydrates; a
    // fill that lands pre-hydration dispatches into dead markup and the
    // debounced save silently never fires (#109). The page's mount reads
    // settle only after hydration — wait for that, then touch the dial,
    // and hold the walk's advance until the save's round trip lands (the
    // same gate the income step uses).
    await page.waitForLoadState("networkidle");
    const dialRoundTrip = page.waitForResponse(
      (response) => response.request().method() === "POST"
    );
    await firstDial.fill("8");
    await dialRoundTrip;

    // Setup complete = Safe-to-Spend computable: the walk retires, the
    // heartbeat answers from stated income, and the quiet link nudge
    // persists because no Linked Account exists.
    await page.goto("/dashboard");
    await expect(page.getByText("Safe-to-Spend")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText("This month, from your stated income")
    ).toBeVisible();
    await expect(page.locator("[data-setup-walk]")).toHaveCount(0);
    await expect(page.getByText("Link your accounts")).toBeVisible();

    // Post-setup, the side-quest card offers the reflective pair; dismiss
    // forever hides it (it lives on in Settings).
    await expect(page.locator("[data-side-quest]")).toBeVisible({
      timeout: 20_000,
    });
    await page
      .getByRole("button", { name: "Not now — don't ask again" })
      .click();
    await expect(page.locator("[data-side-quest]")).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByText("Safe-to-Spend")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("[data-side-quest]")).toHaveCount(0);
  });
});

// The signed-in smoke needs the seeded fixture household (see
// global-setup.ts); without it this block skips loudly instead of failing.
test.describe("signed-in canonical pages", () => {
  test.skip(
    process.env.E2E_SEED_FIXTURE !== "1",
    "Signed-in flow smoke needs the seeded fixture household: run with E2E_SEED_FIXTURE=1 (writes an isolated e2e-spending-* household to the shared DB)."
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
    await page.getByLabel("Password").fill(e2eSpendingPassword());
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });

  // #49: income is server-authoritative. An add on the canonical page is an
  // awaited per-intent action — once its round trip lands, a full
  // navigation loses nothing (the #13 lost-write scenario). Cleans up after
  // itself so the spending-smoke income totals stay untouched.
  test("income add survives fast navigation; the canonical page owns the truth", async ({
    page,
  }) => {
    await page.goto("/dashboard/income");
    await page.getByLabel("Income Source").fill("E2E Fast Nav Income");
    await page.getByLabel("Monthly Amount").fill("123");

    // Match the add action's own POST (its body carries the new name) — a
    // late-resolving hydration read also POSTs to this URL, and matching it
    // would let the navigation below abort the still-in-flight write.
    const addRoundTrip = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/dashboard/income") &&
        (response.request().postData() ?? "").includes("E2E Fast Nav Income")
    );
    await page.getByRole("button", { name: "Add Income" }).click();
    // Optimistic: the row is visible before the server answers.
    await expect(page.getByText("E2E Fast Nav Income")).toBeVisible();
    await addRoundTrip;

    // Full page load straight after the write — this aborted the debounced
    // flush in the old architecture and silently lost the row.
    await page.goto("/dashboard/income");
    await expect(page.getByText("E2E Fast Nav Income")).toBeVisible({
      timeout: 15_000,
    });

    // Awaited remove; a reload then proves the delete reached the server
    // (a failed delete would re-hydrate the row from server truth). Drain
    // ALL in-flight requests before reloading — a response-predicate wait
    // can be satisfied by a concurrent hydration read while the remove
    // action is still in flight, and the reload would abort it mid-write.
    await page
      .locator("div")
      .filter({ hasText: "E2E Fast Nav Income" })
      .filter({ has: page.getByRole("button", { name: "Remove" }) })
      .last()
      .getByRole("button", { name: "Remove" })
      .click();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Regular Income" })
    ).toBeVisible();
    await expect(page.getByText("E2E Fast Nav Income")).toHaveCount(0);
  });

  // #50: fixed-cost line items are server-authoritative — an add is an
  // awaited per-intent action, so a full reload right after the round trip
  // loses nothing and ids stay stable. Cleans up after itself.
  test("fixed-cost line item survives a full reload; awaited remove sticks", async ({
    page,
  }) => {
    await page.goto("/dashboard/fixed-costs");
    await page.getByLabel("Line item name").fill("E2E Fast Nav Utility");
    await page.getByLabel("Monthly amount").fill("77");

    // Body-marker match, same reason as the income add above.
    const addRoundTrip = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/dashboard/fixed-costs") &&
        (response.request().postData() ?? "").includes("E2E Fast Nav Utility")
    );
    await page.getByRole("button", { name: "Add line item" }).click();
    // Optimistic: visible before the server answers.
    await expect(page.getByText("E2E Fast Nav Utility")).toBeVisible();
    await addRoundTrip;

    // Full page load straight after the write — the old debounced flush
    // lost this row (#13); the awaited action does not.
    await page.goto("/dashboard/fixed-costs");
    await expect(page.getByText("E2E Fast Nav Utility")).toBeVisible({
      timeout: 15_000,
    });

    // Network drain instead of a response-predicate wait — same reason as
    // the income remove above.
    await page
      .locator("div")
      .filter({ hasText: "E2E Fast Nav Utility" })
      .filter({ has: page.getByRole("button", { name: "Remove" }) })
      .last()
      .getByRole("button", { name: "Remove" })
      .click();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Fixed Costs", exact: true })
    ).toBeVisible();
    await expect(page.getByText("E2E Fast Nav Utility")).toHaveCount(0);
  });
});
