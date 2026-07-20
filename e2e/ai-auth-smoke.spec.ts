import { expect, test } from "@playwright/test";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

loadDotEnv();

// AI-route auth gating (#109): the AI endpoints spend the household's
// Anthropic budget, so anonymous POSTs must get a 401 — never a
// completion. Calculation endpoints are pure math and stay open.

const AI_ROUTES = [
  "/api/ai/couples-counselor",
  "/api/ai/monthly-checkin",
  "/api/ai/plan-review",
  "/api/ai/script-reflection",
];

test("anonymous POSTs to every AI route get 401", async ({ request }) => {
  for (const route of AI_ROUTES) {
    const response = await request.post(route, { data: {} });
    expect(response.status(), `${route} must 401 anonymously`).toBe(401);
  }
});

test("calculation endpoints stay open: pure math needs no session", async ({
  request,
}) => {
  const response = await request.post("/api/calculations/debt-payoff", {
    data: {
      debts: [
        {
          name: "E2E Card",
          balance: 1000,
          apr: 20,
          minimumPayment: 35,
          debtType: "credit_card",
        },
      ],
      extraMonthlyPayment: 100,
    },
  });
  expect(response.status()).toBe(200);
});

test.describe("authenticated AI access", () => {
  test.skip(
    process.env.E2E_SEED_FIXTURE !== "1",
    "Needs the seeded fixture household: run with E2E_SEED_FIXTURE=1."
  );

  test("an authenticated POST passes the gate", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
    await page.getByLabel("Password").fill(e2eSpendingPassword());
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    // A deliberately malformed body: the route's json() parse throws and
    // it answers 500 — which proves the request got PAST the auth gate
    // without spending a single Anthropic token. Anonymously this same
    // request answers 401 (pinned above).
    const response = await page.request.post("/api/ai/monthly-checkin", {
      headers: { "content-type": "application/json" },
      data: "not json {",
    });
    expect(response.status()).toBe(500);
  });
});
