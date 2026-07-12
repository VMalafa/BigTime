// Playwright global setup: seeds the isolated e2e-spending fixture household.
//
// Everything here is an upsert with a deterministic `e2e-spending-` id — the
// seed never deletes anything and never touches real household rows. The
// fixture's AggregatorConnection is REVOKED so the daily sync cron skips it.

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

const PROFILE_ID = "e2e-spending-profile";
const CONNECTION_ID = "e2e-spending-conn";
const CHECKING_ID = "e2e-spending-checking";
const CARD_ID = "e2e-spending-card";

async function ensureAuthUser(): Promise<string> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const password = e2eSpendingPassword();

  const { data, error } = await admin.auth.admin.createUser({
    email: E2E_SPENDING_EMAIL,
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
  const existing = list.users.find((u) => u.email === E2E_SPENDING_EMAIL);
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
  const authUserId = await ensureAuthUser();
  const prisma = new PrismaClient();

  try {
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

    // Conscious Spending Plan: 50 / 10 / 10 / 30
    await prisma.spendingPlan.upsert({
      where: { profileId: PROFILE_ID },
      update: {
        fixedCostsPercent: 50,
        savingsPercent: 10,
        investmentsPercent: 10,
        guiltFreePercent: 30,
      },
      create: {
        profileId: PROFILE_ID,
        fixedCostsPercent: 50,
        savingsPercent: 10,
        investmentsPercent: 10,
        guiltFreePercent: 30,
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

    for (const account of [
      { id: CHECKING_ID, externalId: "e2e-checking", name: "E2E Checking", accountType: "CHECKING" as const, balance: 4200 },
      { id: CARD_ID, externalId: "e2e-card", name: "E2E Card", accountType: "CREDIT_CARD" as const, balance: -350 },
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
  } finally {
    await prisma.$disconnect();
  }
}
