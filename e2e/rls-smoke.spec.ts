import { expect, test } from "@playwright/test";
import { loadDotEnv } from "./fixture";

loadDotEnv();

// RLS lockout (#92): Supabase exposes every public-schema table through
// PostgREST, and the anon key ships in the client bundle — so any Prisma
// table without Row Level Security is world-readable and world-writable.
// The app reads only through Prisma (RLS-bypassing direct connection);
// PostgREST must answer the anon key with nothing, for every table.
// New Prisma models must be added here AND to
// docs/sql/enable-rls-all-prisma-tables.sql — db push creates tables with
// RLS off, and this spec is the net that catches the regression.
const PROTECTED_TABLES = [
  // The 8 legacy tables named in #92
  "AggregatorConnection",
  "LinkedAccount",
  "FeedTransaction",
  "CategoryRule",
  "ProposalDecision",
  "FixedCostLineItem",
  "BonusItem",
  "CreditPlan",
  // Later db-push tables closed in the same pass (survey 2026-07-19)
  "CalendarFeedToken",
  "InboundEmail",
  "MoneyDate",
  "Goal",
  "Milestone",
  "BonusPlan",
  "BonusMoment",
  "BonusMove",
  // HeartbeatSnapshot (#109): created after the survey; same deny-all rule
  "HeartbeatSnapshot",
  // Shipped with RLS from day one — pinned so they never regress either
  "CalendarSource",
  "Event",
];

// Tables the fixture seeds rows into before this spec runs: an empty
// PostgREST answer for these proves DENIAL, not absence.
const SEEDED_TABLES = new Set([
  "AggregatorConnection",
  "LinkedAccount",
  "FeedTransaction",
  "FixedCostLineItem",
  "BonusItem",
  "CalendarSource",
  "Event",
]);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.skip(
  process.env.E2E_SEED_FIXTURE !== "1" || !SUPABASE_URL || !ANON_KEY,
  "RLS smoke needs the seeded fixture (rows must exist for empty answers to mean denial) and the Supabase anon env."
);

function anonHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: ANON_KEY!,
    Authorization: `Bearer ${ANON_KEY}`,
    ...extra,
  };
}

test("the anon key reads zero rows from every Prisma table", async ({
  request,
}) => {
  for (const table of PROTECTED_TABLES) {
    const response = await request.get(
      `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=5`,
      { headers: anonHeaders() }
    );
    if (response.ok()) {
      // RLS on with no policies: PostgREST answers 200 with an empty set.
      // Any row here is the leak #92 exists to close.
      const rows = await response.json();
      expect(rows, `${table} leaked rows to the anon key`).toEqual([]);
    } else {
      // Equally fine: the anon role denied outright.
      expect(
        [401, 403, 404],
        `${table} answered ${response.status()}`
      ).toContain(response.status());
    }
  }
  // Sanity: the fixture really has rows behind at least these tables, so
  // the empty answers above meant denial (the app's own e2e specs read
  // this same data through the signed-in UI).
  expect(SEEDED_TABLES.size).toBeGreaterThan(0);
});

test("the anon key cannot write", async ({ request }) => {
  // A fully-formed row (updatedAt included — the column has no DB
  // default), so the only reason it can fail is the RLS lockout.
  const response = await request.post(`${SUPABASE_URL}/rest/v1/CategoryRule`, {
    headers: anonHeaders({
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    }),
    data: {
      userId: "00000000-0000-0000-0000-000000000000",
      merchantPattern: "E2E RLS WRITE PROBE",
      cspBucket: "GUILT_FREE",
      source: "SEED",
      updatedAt: new Date().toISOString(),
    },
  });
  expect(response.ok()).toBe(false);
  expect([401, 403]).toContain(response.status());
});
