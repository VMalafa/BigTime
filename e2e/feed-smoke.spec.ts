import { expect, test } from "@playwright/test";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

loadDotEnv();

// Subscribable feed (#90): mint in Settings, fetch as a subscription
// client would (no cookies — the token is the whole auth), rotate, revoke.
test.skip(
  process.env.E2E_SEED_FIXTURE !== "1",
  "Feed smoke needs the seeded fixture household: run with E2E_SEED_FIXTURE=1 (writes an isolated e2e-spending-* household to the shared DB)."
);

const TOKEN_IN_URL = /\/api\/calendar\/feed\/([A-Za-z0-9_-]{43})\.ics/;

test("feed lifecycle: mint in Settings, serve CONFIRMED life events, rotate, revoke", async ({
  page,
  request,
}) => {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  await page.goto("/dashboard/settings");

  // --- Mint a whole-timeline feed and a per-source feed.
  await page.getByLabel("Feed scope").selectOption({ index: 0 });
  await page.getByRole("button", { name: "Create feed" }).click();
  await expect(page.getByText(/webcal:\/\//).first()).toBeVisible();

  await page
    .getByLabel("Feed scope")
    .selectOption({ label: "Just E2E School 2026-27" });
  await page.getByRole("button", { name: "Create feed" }).click();
  await expect(page.getByText(/webcal:\/\//).nth(1)).toBeVisible();

  const urls = await page.getByText(/webcal:\/\//).allTextContents();
  const householdToken = TOKEN_IN_URL.exec(urls[0])?.[1];
  const schoolToken = TOKEN_IN_URL.exec(urls[1])?.[1];
  expect(householdToken).toBeTruthy();
  expect(schoolToken).toBeTruthy();

  // --- The whole-timeline feed: CONFIRMED life Events only. Drafts,
  // dismissals, and the money rhythm (never stored as Events) stay out.
  const household = await request.get(
    `/api/calendar/feed/${householdToken}.ics`
  );
  expect(household.status()).toBe(200);
  expect(household.headers()["content-type"]).toContain("text/calendar");
  const householdIcs = await household.text();
  expect(householdIcs).toContain("X-WR-CALNAME:Household Timeline");
  expect(householdIcs).toContain("Noon Dismissal – E2E School");
  expect(householdIcs).toContain("E2E School Holiday");
  expect(householdIcs).not.toContain("E2E Draft Only Event");
  expect(householdIcs).not.toContain("E2E Dismissed Only Event");
  expect(householdIcs).not.toContain("Payday");
  expect(householdIcs).not.toContain("Earmark");

  // --- The per-source feed is named for its Calendar Source.
  const school = await request.get(`/api/calendar/feed/${schoolToken}.ics`);
  expect(school.status()).toBe(200);
  expect(await school.text()).toContain("X-WR-CALNAME:E2E School 2026-27");

  // --- Rotate the school feed: fresh URL works, the old one 404s, and
  // the household feed is untouched.
  await page.getByRole("button", { name: "Rotate" }).nth(1).click();
  await expect(page.getByText(new RegExp(schoolToken!))).toHaveCount(0);
  const rotatedUrls = await page.getByText(/webcal:\/\//).allTextContents();
  const rotatedToken = TOKEN_IN_URL.exec(rotatedUrls[1])?.[1];
  expect(rotatedToken).toBeTruthy();
  expect(rotatedToken).not.toBe(schoolToken);

  expect(
    (await request.get(`/api/calendar/feed/${schoolToken}.ics`)).status()
  ).toBe(404);
  expect(
    (await request.get(`/api/calendar/feed/${rotatedToken}.ics`)).status()
  ).toBe(200);

  // --- Revoke both; each URL 404s.
  await page.getByRole("button", { name: "Revoke" }).first().click();
  await page.getByRole("button", { name: "Revoke" }).first().click();
  await expect(page.getByText(/webcal:\/\//)).toHaveCount(0);
  expect(
    (await request.get(`/api/calendar/feed/${householdToken}.ics`)).status()
  ).toBe(404);
  expect(
    (await request.get(`/api/calendar/feed/${rotatedToken}.ics`)).status()
  ).toBe(404);
});
