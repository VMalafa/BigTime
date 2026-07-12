"use server";

// The household heartbeat, computed fresh from the database on every call —
// it reflects the latest sync each time the dashboard loads.

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { detectRecurringPatterns } from "@/lib/recurring/pattern-engine";
import {
  computeSafeToSpend,
  deriveCurrentPayPeriod,
  deriveEarmarks,
  filterPaycheckDeposits,
} from "@/lib/heartbeat/pay-period";

const LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000;

export interface HeartbeatData {
  available: boolean;
  /** Why the heartbeat is not available yet (Honesty Rule: say so). */
  reason?: string;
  safeToSpendCents?: number;
  paycheckCents?: number;
  earmarkedCents?: number;
  plannedSavingsInvestmentsCents?: number;
  periodStart?: string; // ISO date
  periodEnd?: string;
  projectedEnd?: boolean;
  earmarks?: { name: string; amountCents: number; dueDate: string }[];
  undated?: { name: string; monthlyAmountCents: number }[];
}

export async function getHeartbeat(): Promise<HeartbeatData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { available: false, reason: "Not signed in." };

  const confirmedStreams = await prisma.proposalDecision.findMany({
    where: { userId: user.id, kind: "INCOME", decision: "CONFIRMED" },
    select: { key: true },
  });
  if (confirmedStreams.length === 0) {
    return {
      available: false,
      reason:
        "Confirm an income stream (Income page) to start the heartbeat — Pay Periods are bounded by your paychecks.",
    };
  }

  const [transactions, profiles] = await Promise.all([
    prisma.feedTransaction.findMany({
      where: {
        linkedAccount: { connection: { userId: user.id } },
        postedAt: { gte: new Date(Date.now() - LOOKBACK_MS) },
        isTransfer: false,
      },
      select: {
        id: true,
        postedAt: true,
        amount: true,
        description: true,
        isTransfer: true,
      },
    }),
    prisma.profile.findMany({
      where: { userId: user.id },
      include: {
        spendingPlan: { include: { fixedCostLineItems: true } },
      },
    }),
  ]);

  const paychecks = filterPaycheckDeposits(
    transactions
      .filter((t) => Number(t.amount) > 0)
      .map((t) => ({
        postedAt: t.postedAt,
        amountCents: Math.round(Number(t.amount) * 100),
        description: t.description,
      })),
    confirmedStreams.map((s) => s.key)
  );

  const period = deriveCurrentPayPeriod(paychecks, new Date());
  if (!period) {
    return {
      available: false,
      reason: "No paycheck from a confirmed income stream has landed yet.",
    };
  }

  const chargePatterns = detectRecurringPatterns(
    transactions.map((t) => ({
      id: t.id,
      postedAt: t.postedAt,
      amountCents: Math.round(Number(t.amount) * 100),
      description: t.description,
      isTransfer: t.isTransfer,
    }))
  );

  const plan =
    profiles.find((p) => p.isDefault)?.spendingPlan ??
    profiles.find((p) => p.spendingPlan)?.spendingPlan ??
    null;
  const lineItems = (plan?.fixedCostLineItems ?? []).map((item) => ({
    name: item.name,
    monthlyAmountCents: Math.round(Number(item.monthlyAmount) * 100),
  }));

  const { earmarks, undated } = deriveEarmarks(lineItems, chargePatterns, period);
  const safeToSpend = computeSafeToSpend(
    period,
    earmarks,
    plan
      ? {
          savingsPercent: plan.savingsPercent,
          investmentsPercent: plan.investmentsPercent,
        }
      : null
  );

  return {
    available: true,
    safeToSpendCents: safeToSpend.safeToSpendCents,
    paycheckCents: safeToSpend.paycheckCents,
    earmarkedCents: safeToSpend.earmarkedCents,
    plannedSavingsInvestmentsCents: safeToSpend.plannedSavingsInvestmentsCents,
    periodStart: period.start.toISOString(),
    periodEnd: period.endExclusive.toISOString(),
    projectedEnd: period.projectedEnd,
    earmarks: earmarks.map((e) => ({
      name: e.name,
      amountCents: e.amountCents,
      dueDate: e.dueDate.toISOString(),
    })),
    undated,
  };
}
