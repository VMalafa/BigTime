"use server";

// The household heartbeat, computed fresh from the database on every call —
// it reflects the latest sync each time the dashboard loads.

import { prisma } from "@/lib/prisma";
import {
  computeSafeToSpend,
  deriveCurrentPayPeriod,
  deriveEarmarks,
} from "@/lib/heartbeat/pay-period";
import {
  computeHeartbeatDetection,
  readHeartbeatSnapshot,
} from "@/lib/heartbeat/snapshot";
import { computeManualHeartbeat } from "@/lib/heartbeat/manual";
import { sliceEarmark } from "@/lib/goals/engine";
import { getRequestUser } from "@/lib/auth/request-user";

export interface HeartbeatData {
  available: boolean;
  /** Why the heartbeat is not available yet (Honesty Rule: say so). */
  reason?: string;
  /** True when computed from stated income on the calendar month (#73's
   * manual fuel) rather than feed-bounded Pay Periods. */
  manualFuel?: boolean;
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
  const user = await getRequestUser();
  if (!user) return { available: false, reason: "Not signed in." };

  const confirmedStreams = await prisma.proposalDecision.findMany({
    where: { userId: user.id, kind: "INCOME", decision: "CONFIRMED" },
    select: { key: true },
  });
  if (confirmedStreams.length === 0) {
    return (
      (await manualHeartbeat(user.id)) ?? {
        available: false,
        reason:
          "Add your income (Income page) to start the heartbeat — Safe-to-Spend needs a number to start from.",
      }
    );
  }

  // The expensive detection half (#109): read the sync-time snapshot when
  // one exists — one cheap row instead of a 180-day Transaction scan plus
  // pattern detection per view. A household that has never synced (no
  // snapshot row) computes live, exactly as before.
  const detection =
    (await readHeartbeatSnapshot(user.id)) ??
    (await computeHeartbeatDetection(
      user.id,
      confirmedStreams.map((s) => s.key)
    ));
  const { paychecks, chargePatterns } = detection;

  const profiles = await prisma.profile.findMany({
    where: { userId: user.id },
    include: {
      spendingPlan: { include: { fixedCostLineItems: true } },
    },
  });

  const period = deriveCurrentPayPeriod(paychecks, new Date());
  if (!period) {
    return (
      (await manualHeartbeat(user.id)) ?? {
        available: false,
        reason: "No paycheck from a confirmed income stream has landed yet.",
      }
    );
  }

  const plan =
    profiles.find((p) => p.isDefault)?.spendingPlan ??
    profiles.find((p) => p.spendingPlan)?.spendingPlan ??
    null;
  const lineItems = (plan?.fixedCostLineItems ?? []).map((item) => ({
    name: item.name,
    monthlyAmountCents: Math.round(Number(item.monthlyAmount) * 100),
  }));

  const { earmarks, undated } = deriveEarmarks(lineItems, chargePatterns, period);

  // The Spotlight slice (#86): a per-Pay-Period reservation riding the
  // Earmark engine — Safe-to-Spend subtracts it, covered-by-default
  // styling applies, and an unfundable slice raises Weather like any
  // other unfunded Earmark.
  const spotlight = await prisma.goal.findFirst({
    where: { userId: user.id, isSpotlight: true },
    include: { linkedAccount: { select: { currentBalance: true } } },
  });
  const slice = sliceEarmark(
    spotlight
      ? {
          id: spotlight.id,
          name: spotlight.name,
          emoji: spotlight.emoji,
          targetCents: spotlight.targetCents,
          linkedBalanceCents: spotlight.linkedAccount
            ? Math.round(Number(spotlight.linkedAccount.currentBalance) * 100)
            : null,
          manualCents: spotlight.manualCents,
          isSpotlight: true,
          sliceCents: spotlight.sliceCents,
        }
      : null,
    period.endExclusive
  );
  if (slice) {
    earmarks.push(slice);
    earmarks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

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

// Manual fuel (#73): no feed paychecks to bound a Pay Period, so stated
// income powers a calendar-month Safe-to-Spend until a linked paycheck
// lands and the feed-bounded heartbeat takes over.
async function manualHeartbeat(userId: string): Promise<HeartbeatData | null> {
  const profiles = await prisma.profile.findMany({
    where: { userId },
    include: {
      incomeSources: true,
      spendingPlan: { include: { fixedCostLineItems: true } },
    },
  });

  const monthlyIncomeCents = profiles
    .flatMap((p) => p.incomeSources)
    .reduce((sum, s) => sum + Math.round(Number(s.monthlyAmount) * 100), 0);
  const plan =
    profiles.find((p) => p.isDefault)?.spendingPlan ??
    profiles.find((p) => p.spendingPlan)?.spendingPlan ??
    null;

  const manual = computeManualHeartbeat({
    monthlyIncomeCents,
    lineItems: (plan?.fixedCostLineItems ?? []).map((item) => ({
      name: item.name,
      monthlyAmountCents: Math.round(Number(item.monthlyAmount) * 100),
    })),
    plan: plan
      ? {
          savingsPercent: plan.savingsPercent,
          investmentsPercent: plan.investmentsPercent,
        }
      : null,
    now: new Date(),
  });
  if (!manual) return null;

  return {
    available: true,
    manualFuel: true,
    safeToSpendCents: manual.safeToSpendCents,
    paycheckCents: manual.paycheckCents,
    earmarkedCents: manual.earmarkedCents,
    plannedSavingsInvestmentsCents: manual.plannedSavingsInvestmentsCents,
    periodStart: manual.periodStart.toISOString(),
    periodEnd: manual.periodEndExclusive.toISOString(),
    projectedEnd: false,
    earmarks: [],
    undated: [],
  };
}
