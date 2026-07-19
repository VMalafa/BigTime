// Playwright global setup: seeds the isolated e2e-spending fixture household.
//
// Everything here is an upsert with a deterministic `e2e-spending-` id — the
// seed never deletes anything and never touches real household rows. The
// fixture's AggregatorConnection is REVOKED so the daily sync cron skips it.

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import {
  E2E_MANUAL_EMAIL,
  E2E_SPENDING_EMAIL,
  e2eManualPassword,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";
import { normalizeEventTitle } from "../src/lib/timeline/natural-key";

// A second, pre-confirmed paycheck stream for the timeline smoke (#56):
// letters-only so normalizeMerchant keeps the pattern intact, deposits in
// past months only so current-month spending assertions stay untouched,
// and its INCOME decision seeded CONFIRMED so it powers the money rhythm
// without ever appearing as a Proposal (the ACME stream stays proposed for
// the spending smoke).
const TIMELINE_STREAM = "ETE TIMELINE PAYROLL DEPOSIT";

const PROFILE_ID = "e2e-spending-profile";
const CONNECTION_ID = "e2e-spending-conn";
const CHECKING_ID = "e2e-spending-checking";
const CARD_ID = "e2e-spending-card";

async function ensureAuthUser(email: string, password: string): Promise<string> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error) return data.user.id;

  if (!/already|exists|registered/i.test(error.message)) {
    throw new Error(`Could not create e2e auth user: ${error.message}`);
  }
  // Already present from an earlier run — find it and keep the password in
  // sync with the current derivation.
  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw new Error(`Could not list users: ${listError.message}`);
  const existing = list.users.find((u) => u.email === email);
  if (!existing) throw new Error("e2e auth user exists but was not found");
  await admin.auth.admin.updateUserById(existing.id, { password });
  return existing.id;
}

export default async function globalSetup() {
  // Seeding writes fixture rows (isolated `e2e-spending-` household) to the
  // shared database and one confirmed user to the auth pool. That is a
  // deliberate, human-authorized action: opt in explicitly.
  //   PowerShell: $env:E2E_SEED_FIXTURE="1"; npm run test:e2e
  if (process.env.E2E_SEED_FIXTURE !== "1") {
    console.log(
      "[e2e] E2E_SEED_FIXTURE is not set — fixture household not seeded; " +
        "the signed-in spending spec will skip itself."
    );
    return;
  }

  loadDotEnv();
  const authUserId = await ensureAuthUser(
    E2E_SPENDING_EMAIL,
    e2eSpendingPassword()
  );
  const manualUserId = await ensureAuthUser(
    E2E_MANUAL_EMAIL,
    e2eManualPassword()
  );
  const prisma = new PrismaClient();

  try {
    // Reset fixture-household state accumulated by earlier E2E runs so every
    // run starts identical. Scoped strictly to the fixture user's rows —
    // never touches real household data.
    await prisma.proposalDecision.deleteMany({ where: { userId: authUserId } });
    await prisma.categoryRule.deleteMany({ where: { userId: authUserId } });
    await prisma.debt.deleteMany({
      where: { profile: { id: PROFILE_ID } },
    }); // unmaps the fixture card via onDelete: SetNull
    await prisma.fixedCostLineItem.deleteMany({
      where: { spendingPlan: { profileId: PROFILE_ID } },
    });
    // Confirmed income Proposals from earlier runs — reseeded below.
    await prisma.incomeSource.deleteMany({ where: { profileId: PROFILE_ID } });
    // Calendar Sources from earlier ingestion runs (#55) — deleting the
    // source cascades to its Events, so every run reviews a fresh import.
    await prisma.calendarSource.deleteMany({ where: { userId: authUserId } });
    // Inbound email ledger (#69) — fresh per run.
    await prisma.inboundEmail.deleteMany({ where: { userId: authUserId } });
    // Goals & Milestones (#86) — fresh per run.
    await prisma.milestone.deleteMany({ where: { userId: authUserId } });
    await prisma.goal.deleteMany({ where: { userId: authUserId } });
    // Money Dates (#81) — fresh per run; one CheckIn row stands as the
    // ritual's read-only pre-history.
    await prisma.moneyDate.deleteMany({ where: { userId: authUserId } });
    await prisma.checkIn.upsert({
      where: {
        userId_month: {
          userId: authUserId,
          month: new Date(Date.UTC(2026, 4, 1)),
        },
      },
      update: {},
      create: {
        userId: authUserId,
        month: new Date(Date.UTC(2026, 4, 1)),
        wentWell: "E2E pre-history: stayed under on groceries.",
        feltHard: "E2E pre-history: the surprise car bill.",
      },
    });

    await prisma.user.upsert({
      where: { id: authUserId },
      update: {},
      create: {
        id: authUserId,
        email: E2E_SPENDING_EMAIL,
        name: "E2E Fixture Household",
      },
    });

    await prisma.profile.upsert({
      where: { id: PROFILE_ID },
      update: { userId: authUserId },
      create: {
        id: PROFILE_ID,
        userId: authUserId,
        name: "E2E Fixture",
        isDefault: true,
      },
    });

    // Conscious Spending Plan: 50 / 10 / 10 / 30. Overridden so the
    // derived-Fixed-Costs sync (#50) never rewrites the seeded 50% when
    // other specs add or remove line items — the household "chose" it.
    await prisma.spendingPlan.upsert({
      where: { profileId: PROFILE_ID },
      update: {
        fixedCostsPercent: 50,
        savingsPercent: 10,
        investmentsPercent: 10,
        guiltFreePercent: 30,
        fixedCostsOverridden: true,
      },
      create: {
        profileId: PROFILE_ID,
        fixedCostsPercent: 50,
        savingsPercent: 10,
        investmentsPercent: 10,
        guiltFreePercent: 30,
        fixedCostsOverridden: true,
      },
    });

    await prisma.incomeSource.upsert({
      where: { id: "e2e-spending-income" },
      update: { monthlyAmount: 6000 },
      create: {
        id: "e2e-spending-income",
        profileId: PROFILE_ID,
        name: "E2E Salary",
        monthlyAmount: 6000,
        isAfterTax: true,
      },
    });

    // REVOKED: the daily sync cron skips revoked connections, so the fake
    // access secret is never used.
    await prisma.aggregatorConnection.upsert({
      where: { id: CONNECTION_ID },
      update: { status: "REVOKED" },
      create: {
        id: CONNECTION_ID,
        userId: authUserId,
        provider: "SIMPLEFIN",
        encryptedAccessSecret: "e2e-fixture-not-a-real-secret",
        status: "REVOKED",
      },
    });

    const now = new Date();
    const day = (d: number) =>
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), d, 12));
    const monthDay = (monthOffset: number, d: number) =>
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, d, 12));

    for (const account of [
      { id: CHECKING_ID, externalId: "e2e-checking", name: "E2E Checking", accountType: "CHECKING" as const, balance: 4200 },
      { id: CARD_ID, externalId: "e2e-card", name: "E2E Card", accountType: "CREDIT_CARD" as const, balance: -350 },
      // Goals v1 (#86): a savings account for the 1:1 Goal link — its
      // feed balance owns the Spotlight's progress (3400 of a 10k target
      // → 34% funded, deterministic).
      { id: "e2e-spending-savings", externalId: "e2e-savings", name: "E2E Savings", accountType: "SAVINGS" as const, balance: 3400 },
    ]) {
      await prisma.linkedAccount.upsert({
        where: { id: account.id },
        update: { balanceAsOf: day(1) },
        create: {
          id: account.id,
          connectionId: CONNECTION_ID,
          externalId: account.externalId,
          name: account.name,
          institution: "E2E Bank",
          accountType: account.accountType,
          currentBalance: account.balance,
          balanceAsOf: day(1),
        },
      });
    }

    // Current-month transactions: income, one per bucket, a Transfer pair,
    // and two honest UNCATEGORIZED stragglers. Re-runs move postedAt into
    // the current month so the default month view always has data.
    const transactions = [
      { id: "e2e-spending-t1", accountId: CHECKING_ID, externalId: "e2e-t1", postedAt: day(2), amount: 6000, description: "ACME CORP PAYROLL", cspBucket: "UNCATEGORIZED" as const, isTransfer: false, transferPairId: null },
      { id: "e2e-spending-t2", accountId: CHECKING_ID, externalId: "e2e-t2", postedAt: day(3), amount: -1800, description: "OAKWOOD APARTMENTS RENT", cspBucket: "FIXED_COSTS" as const, fixedCostCategory: "HOUSING" as const, isTransfer: false, transferPairId: null },
      { id: "e2e-spending-t3", accountId: CHECKING_ID, externalId: "e2e-t3", postedAt: day(4), amount: -500, description: "AUTO SAVE TO ALLY SAVINGS", cspBucket: "SAVINGS" as const, isTransfer: false, transferPairId: null },
      { id: "e2e-spending-t4", accountId: CHECKING_ID, externalId: "e2e-t4", postedAt: day(5), amount: -300, description: "VANGUARD BROKERAGE", cspBucket: "INVESTMENTS" as const, isTransfer: false, transferPairId: null },
      { id: "e2e-spending-t5", accountId: CHECKING_ID, externalId: "e2e-t5", postedAt: day(6), amount: -120, description: "SUSHI GARDEN", cspBucket: "GUILT_FREE" as const, moneyDial: "FOOD_DINING" as const, isTransfer: false, transferPairId: null },
      { id: "e2e-spending-t6", accountId: CHECKING_ID, externalId: "e2e-t6", postedAt: day(7), amount: -400, description: "E2E PAYMENT TO CARD", cspBucket: "UNCATEGORIZED" as const, isTransfer: true, transferPairId: "e2e-spending-t7" },
      { id: "e2e-spending-t7", accountId: CARD_ID, externalId: "e2e-t7", postedAt: day(8), amount: 400, description: "E2E PAYMENT RECEIVED", cspBucket: "UNCATEGORIZED" as const, isTransfer: true, transferPairId: "e2e-spending-t6" },
      { id: "e2e-spending-t8", accountId: CHECKING_ID, externalId: "e2e-t8", postedAt: day(9), amount: -60, description: "MYSTERY MERCHANT 4821", cspBucket: "UNCATEGORIZED" as const, isTransfer: false, transferPairId: null },
      { id: "e2e-spending-t9", accountId: CARD_ID, externalId: "e2e-t9", postedAt: day(10), amount: -45, description: "SQ *CORNER STORE", cspBucket: "UNCATEGORIZED" as const, isTransfer: false, transferPairId: null },
      // Recurring history for the onboarding-Proposals path: a monthly
      // subscription (clear-cut -> confirm-all tier) and monthly rent
      // (plan-moving -> individual tier). Past months only, so the
      // current-month spending assertions stay untouched.
      ...[-4, -3, -2, -1].flatMap((offset, i) => [
        { id: `e2e-spending-nf${i}`, accountId: CHECKING_ID, externalId: `e2e-nf${i}`, postedAt: monthDay(offset, 12), amount: -15.49, description: "NETFLIX.COM 866-579-7172", cspBucket: "UNCATEGORIZED" as const, isTransfer: false, transferPairId: null },
        { id: `e2e-spending-rent${i}`, accountId: CHECKING_ID, externalId: `e2e-rent${i}`, postedAt: monthDay(offset, 3), amount: -1800, description: "OAKWOOD APARTMENTS RENT", cspBucket: "UNCATEGORIZED" as const, isTransfer: false, transferPairId: null },
      ]),
      // Renewal radar (#70): an annual insurance charge, two occurrences a
      // year apart (past months only, single occurrence inside the 180-day
      // windows, so earmarks/proposals never see a pattern).
      { id: "e2e-spending-ins0", accountId: CHECKING_ID, externalId: "e2e-ins0", postedAt: monthDay(-13, 6), amount: -1285, description: "ACME INSURANCE ANNUAL PREMIUM", cspBucket: "UNCATEGORIZED" as const, isTransfer: false, transferPairId: null },
      { id: "e2e-spending-ins1", accountId: CHECKING_ID, externalId: "e2e-ins1", postedAt: monthDay(-1, 6), amount: -1285, description: "ACME INSURANCE ANNUAL PREMIUM", cspBucket: "UNCATEGORIZED" as const, isTransfer: false, transferPairId: null },
      // Semi-monthly paycheck-like deposit stream (1st & 15th, past months
      // only) for the Income Proposal path: $2,750 × 2/mo -> $5,500/mo.
      ...[-3, -2, -1].flatMap((offset, i) => [
        { id: `e2e-spending-pay${i}a`, accountId: CHECKING_ID, externalId: `e2e-pay${i}a`, postedAt: monthDay(offset, 1), amount: 2750, description: "ACME CORP DES:PAYROLL 001", cspBucket: "UNCATEGORIZED" as const, isTransfer: false, transferPairId: null },
        { id: `e2e-spending-pay${i}b`, accountId: CHECKING_ID, externalId: `e2e-pay${i}b`, postedAt: monthDay(offset, 15), amount: 2750, description: "ACME CORP DES:PAYROLL 001", cspBucket: "UNCATEGORIZED" as const, isTransfer: false, transferPairId: null },
      ]),
    ];

    for (const t of transactions) {
      const data = {
        postedAt: t.postedAt,
        amount: t.amount,
        description: t.description,
        cspBucket: t.cspBucket,
        moneyDial: "moneyDial" in t ? t.moneyDial : null,
        fixedCostCategory: "fixedCostCategory" in t ? t.fixedCostCategory : null,
        isTransfer: t.isTransfer,
        transferPairId: t.transferPairId,
      };
      await prisma.feedTransaction.upsert({
        where: {
          linkedAccountId_externalId: {
            linkedAccountId: t.accountId,
            externalId: t.externalId,
          },
        },
        update: data,
        create: { id: t.id, linkedAccountId: t.accountId, externalId: t.externalId, ...data },
      });
    }

    // ------------------------------------------------------------------
    // Timeline fixture (#56)

    // Pre-confirmed second paycheck stream: biweekly-ish deposits, PAST
    // months only (current-month income assertions stay at $6,000); the
    // projection engine still derives future paydays from the rhythm.
    await prisma.proposalDecision.create({
      data: {
        userId: authUserId,
        kind: "INCOME",
        key: TIMELINE_STREAM,
        decision: "CONFIRMED",
      },
    });
    const timelineDeposits = [-3, -2, -1].flatMap((offset, i) => [
      { externalId: `e2e-tl-pay${i}a`, postedAt: monthDay(offset, 2), amount: 1500 },
      { externalId: `e2e-tl-pay${i}b`, postedAt: monthDay(offset, 16), amount: 1500 },
    ]);
    for (const d of timelineDeposits) {
      await prisma.feedTransaction.upsert({
        where: {
          linkedAccountId_externalId: {
            linkedAccountId: CHECKING_ID,
            externalId: d.externalId,
          },
        },
        update: { postedAt: d.postedAt },
        create: {
          linkedAccountId: CHECKING_ID,
          externalId: d.externalId,
          postedAt: d.postedAt,
          amount: d.amount,
          description: TIMELINE_STREAM,
          cspBucket: "UNCATEGORIZED",
          isTransfer: false,
        },
      });
    }

    // A fixed cost with a matching PAST-months charge stream so an Earmark
    // due date renders on the timeline. The matching line-item name also
    // keeps this stream out of the fixed-cost Proposals (existing-name
    // exclusion), so the spending smoke's proposal set is untouched.
    for (const [i, offset] of [-3, -2, -1].entries()) {
      await prisma.feedTransaction.upsert({
        where: {
          linkedAccountId_externalId: {
            linkedAccountId: CHECKING_ID,
            externalId: `e2e-tl-util${i}`,
          },
        },
        update: { postedAt: monthDay(offset, 8) },
        create: {
          linkedAccountId: CHECKING_ID,
          externalId: `e2e-tl-util${i}`,
          postedAt: monthDay(offset, 8),
          amount: -80,
          description: "ETE UTILITY COOP",
          cspBucket: "UNCATEGORIZED",
          isTransfer: false,
        },
      });
    }
    await prisma.fixedCostLineItem.create({
      data: {
        id: "e2e-timeline-utility",
        spendingPlan: { connect: { profileId: PROFILE_ID } },
        category: "UTILITIES",
        name: "Ete Utility Coop",
        monthlyAmount: 80,
        note: "Timeline fixture",
        sortOrder: 0,
      },
    });

    // Confirmed school Events in the coming two weeks, plus a DRAFT and a
    // DISMISSED row that must never render on the timeline.
    const schoolEvent = (
      daysAhead: number,
      title: string,
      category: string,
      status: "CONFIRMED" | "DRAFT" | "DISMISSED",
      costCents: number | null = null
    ) => {
      const date = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
      const startDate = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
      );
      return {
        startDate,
        title,
        normalizedTitle: normalizeEventTitle(title),
        category,
        status,
        costCents,
      };
    };
    await prisma.calendarSource.create({
      data: {
        id: "e2e-timeline-school",
        userId: authUserId,
        name: "E2E School 2026-27",
        kind: "IMPORT_ICS",
        sourceStamp: "UPDATED 6/3/26",
        categories: ["holiday", "dismissal", "event"],
        events: {
          create: [
            // Cost display (#72): "Extended Day · $40"-style plain info.
            schoolEvent(3, "Noon Dismissal – E2E School", "dismissal", "CONFIRMED", 4000),
            // Unassigned quirk tomorrow (#79): makes the cross-domain
            // coverage Watch deterministic on Home until a spec assigns it
            // (re-seeded fresh every run).
            schoolEvent(1, "E2E Pickup Quirk – Tomorrow", "dismissal", "CONFIRMED"),
            schoolEvent(10, "E2E School Holiday", "holiday", "CONFIRMED"),
            schoolEvent(5, "E2E Draft Only Event", "event", "DRAFT"),
            schoolEvent(6, "E2E Dismissed Only Event", "event", "DISMISSED"),
          ],
        },
      },
    });

    // ------------------------------------------------------------------
    // Manual-fuel household (#73): user + empty profile only. Reset to a
    // genuinely fresh state every run so the One Flow's manual path is
    // deterministic from step one.
    await prisma.moneyDial.deleteMany({
      where: { profile: { userId: manualUserId } },
    });
    await prisma.fixedCostLineItem.deleteMany({
      where: { spendingPlan: { profile: { userId: manualUserId } } },
    });
    await prisma.spendingPlan.deleteMany({
      where: { profile: { userId: manualUserId } },
    });
    await prisma.incomeSource.deleteMany({
      where: { profile: { userId: manualUserId } },
    });
    await prisma.debt.deleteMany({
      where: { profile: { userId: manualUserId } },
    });
    await prisma.user.upsert({
      where: { id: manualUserId },
      update: { sideQuestDismissedAt: null },
      create: {
        id: manualUserId,
        email: E2E_MANUAL_EMAIL,
        name: "E2E Manual Household",
      },
    });
    await prisma.profile.upsert({
      where: { id: "e2e-manual-profile" },
      update: {},
      create: {
        id: "e2e-manual-profile",
        userId: manualUserId,
        name: "E2E Manual",
        isDefault: true,
      },
    });
    // The side-quest card must reappear for the spending household too.
    await prisma.user.update({
      where: { id: authUserId },
      data: { sideQuestDismissedAt: null },
    });

    // Renewal radar styling states (#70): confirmed renewals at 5, 6, and
    // 20 days out — escalated (loud, soonest only), escalated (quiet — no
    // stacking), and upcoming.
    await prisma.calendarSource.create({
      data: {
        id: "e2e-renewal-source",
        userId: authUserId,
        name: "Feed-derived",
        kind: "FEED_DERIVED",
        categories: ["renewal"],
        events: {
          create: [
            { ...schoolEvent(5, "E2E Insurance Renewal", "renewal", "CONFIRMED", 128500) },
            { ...schoolEvent(6, "E2E Second Renewal", "renewal", "CONFIRMED") },
            { ...schoolEvent(20, "E2E Warranty Renewal", "renewal", "CONFIRMED") },
          ],
        },
      },
    });

  } finally {
    await prisma.$disconnect();
  }
}
