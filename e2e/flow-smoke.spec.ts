import { expect, test } from "@playwright/test";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

loadDotEnv();

// Signup-first (#48): flow pages never render anonymously. Anonymous
// visitors are new households, so the proxy sends them to signup.
test("anonymous flow access redirects to signup", async ({ page }) => {
  for (const path of [
    "/flow",
    "/flow/money-type",
    "/flow/income",
    "/flow/spending-plan",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/signup/);
  }
});

// The signed-in smoke needs the seeded fixture household (see
// global-setup.ts); without it this block skips loudly instead of failing.
test.describe("signed-in flow", () => {
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

  // The onboarding fork renders after the money-type step; "I'll type it in"
  // is the manual path, unchanged: it lands on /flow/debts exactly as the
  // pre-fork Continue did.
  test("onboarding fork after money type; manual path continues to debts", async ({
    page,
  }) => {
    await page.goto("/flow/money-type");
    await page.getByText("The Optimizer").click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(page).toHaveURL(/\/flow\/link-accounts/);
    await expect(
      page.getByText("Link your accounts and we'll fill in the rest")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Link accounts" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Continue typing it in" }).click();
    await expect(page).toHaveURL(/\/flow\/debts/);
    await expect(page.getByText("Let's see the full picture")).toBeVisible();
  });

  // #49: income is server-authoritative. An add on the flow page is an
  // awaited per-intent action — once its round trip lands, a full
  // navigation loses nothing (the #13 lost-write scenario), and the
  // dashboard income page answers from the same source. Cleans up after
  // itself so the spending-smoke income totals stay untouched.
  test("income add survives fast navigation; dashboard reads the same source", async ({
    page,
  }) => {
    await page.goto("/flow/income");
    await page.getByLabel("Income Source").fill("E2E Fast Nav Income");
    await page.getByLabel("Monthly Amount").fill("123");

    const addRoundTrip = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/flow/income")
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
    // (a failed delete would re-hydrate the row from server truth).
    const removeRoundTrip = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/dashboard/income")
    );
    await page
      .locator("div")
      .filter({ hasText: "E2E Fast Nav Income" })
      .filter({ has: page.getByRole("button", { name: "Remove" }) })
      .last()
      .getByRole("button", { name: "Remove" })
      .click();
    await removeRoundTrip;
    await page.reload();
    await expect(page.getByText("Regular Income")).toBeVisible();
    await expect(page.getByText("E2E Fast Nav Income")).toHaveCount(0);
  });
});
