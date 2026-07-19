"use server";

// Money Date actions (#81): every mutation an awaited per-intent action
// (#29). Raising is idempotent on the Pay Period's opening payday; a
// moved Date completing still counts as kept — moved is never skipped.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getHeartbeat, type HeartbeatData } from "@/app/actions/heartbeat";
import { computeWeather, type WeatherReading } from "@/lib/heartbeat/weather";
import { deriveDateInsight } from "@/lib/money-date/beats";
import {
  buildDialDriftReview,
  buildSubscriptionAudit,
  isFirstDateOfMonth,
  type DialDriftReview,
  type SubscriptionAuditRow,
} from "@/lib/money-date/deep";
import {
  computeDialShares,
  DIAL_DRIFT_MIN_TRANSACTIONS,
} from "@/lib/spending/dial-drift";
import { detectRecurringPatterns } from "@/lib/recurring/pattern-engine";
import type { SpendingPlanData } from "@/lib/store/flow-store";
import { getSpendingPlanData } from "@/app/actions/spending-plan";
import {
  monthKeyFor,
  monthRange,
  shiftMonthKey,
  summarizeMonth,
} from "@/lib/spending/month-summary";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export interface MoneyDateSummary {
  id: string;
  periodStart: string;
  status: "RAISED" | "RESCHEDULED" | "COMPLETED";
  scheduledFor: string | null;
  completedAt: string | null;
  presentNames: string[];
}

/** Idempotent raise (#81): paycheck detection = the heartbeat's current
 * feed-bounded period. Manual-fuel months have no payday, so no Date.
 * Takes the caller's already-computed heartbeat — the heavy read must
 * never run twice per glance (#79's lesson). */
export async function ensureMoneyDateRaised(
  userId: string,
  heartbeat: HeartbeatData
): Promise<MoneyDateSummary | null> {
  if (!heartbeat.available || heartbeat.manualFuel || !heartbeat.periodStart) {
    return null;
  }
  const periodStart = new Date(
    `${heartbeat.periodStart.slice(0, 10)}T00:00:00.000Z`
  );
  const row = await prisma.moneyDate.upsert({
    where: { userId_periodStart: { userId, periodStart } },
    update: {},
    create: { userId, periodStart },
  });
  return {
    id: row.id,
    periodStart: row.periodStart.toISOString().slice(0, 10),
    status: row.status,
    scheduledFor: row.scheduledFor
      ? row.scheduledFor.toISOString().slice(0, 10)
      : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    presentNames: row.presentNames,
  };
}

export interface MoneyDateBeats {
  weather: WeatherReading;
  insight: string;
  action: string;
}

export interface MoneyDateDeep {
  dialDrift: DialDriftReview;
  plan: SpendingPlanData | null;
  subscriptions: SubscriptionAuditRow[];
}

export interface MoneyDateTruth {
  current: MoneyDateSummary | null;
  beats: MoneyDateBeats | null;
  /** The monthly depth (#82): present on the first Date of the month. */
  deep: MoneyDateDeep | null;
  archive: MoneyDateSummary[];
  /** Monthly Check-In rows, imported read-only as the ritual's
   * pre-history (#62) — nothing the household wrote is lost. */
  preHistory: {
    month: string;
    wentWell: string | null;
    feltHard: string | null;
    toAdjust: string | null;
    creditWins: string | null;
  }[];
}

export async function getMoneyDateTruth(): Promise<MoneyDateTruth | null> {
  const userId = await requireUserId();
  if (!userId) return null;

  const now = new Date();
  const lastMonth = shiftMonthKey(monthKeyFor(now), -1);
  const { start, endExclusive } = monthRange(lastMonth);

  const [heartbeat, transactions, planRow, archiveRows, checkIns] =
    await Promise.all([
      getHeartbeat(),
      prisma.feedTransaction.findMany({
        where: {
          linkedAccount: { connection: { userId } },
          postedAt: { gte: start, lt: endExclusive },
        },
        select: {
          amount: true,
          cspBucket: true,
          isTransfer: true,
          moneyDial: true,
        },
      }),
      prisma.spendingPlan.findFirst({
        where: { profile: { userId, isDefault: true } },
      }),
      prisma.moneyDate.findMany({
        where: { userId, status: "COMPLETED" },
        orderBy: { periodStart: "desc" },
        take: 24,
      }),
      prisma.checkIn.findMany({
        where: { userId },
        orderBy: { month: "desc" },
        take: 24,
      }),
    ]);

  const current = await ensureMoneyDateRaised(userId, heartbeat);

  const weather = computeWeather({
    heartbeatAvailable: heartbeat.available,
    heartbeatReason: heartbeat.reason ?? null,
    safeToSpendCents: heartbeat.safeToSpendCents,
    paycheckCents: heartbeat.paycheckCents,
    plannedSavingsInvestmentsCents: heartbeat.plannedSavingsInvestmentsCents,
    earmarks: heartbeat.earmarks,
    periodStart: heartbeat.periodStart ?? null,
    today: now.toISOString(),
  });

  const summary = summarizeMonth(
    transactions.map((t) => ({
      amountCents: Math.round(Number(t.amount) * 100),
      cspBucket: t.cspBucket,
      isTransfer: t.isTransfer,
    })),
    planRow
      ? {
          fixedCostsPercent: planRow.fixedCostsPercent,
          savingsPercent: planRow.savingsPercent,
          investmentsPercent: planRow.investmentsPercent,
          guiltFreePercent: planRow.guiltFreePercent,
        }
      : null,
    0
  );

  // The monthly depth (#82): the first Date of the calendar month runs
  // seven cards. Deep data is only assembled when it will be shown.
  let deep: MoneyDateDeep | null = null;
  if (current && current.status !== "COMPLETED") {
    const monthMates = await prisma.moneyDate.findMany({
      where: { userId },
      select: { periodStart: true },
    });
    const firstOfMonth = isFirstDateOfMonth(
      current.periodStart,
      monthMates.map((m) => m.periodStart.toISOString().slice(0, 10))
    );
    if (firstOfMonth) {
      const AUDIT_LOOKBACK_MS = 200 * 24 * 60 * 60 * 1000;
      const [dials, plan, auditTransactions] = await Promise.all([
        prisma.moneyDial.findMany({
          where: { profile: { userId } },
          select: { category: true, level: true },
        }),
        getSpendingPlanData(),
        prisma.feedTransaction.findMany({
          where: {
            linkedAccount: { connection: { userId } },
            postedAt: { gte: new Date(now.getTime() - AUDIT_LOOKBACK_MS) },
            isTransfer: false,
            amount: { lt: 0 },
          },
          select: {
            id: true,
            postedAt: true,
            amount: true,
            description: true,
          },
        }),
      ]);

      const guiltFree = transactions
        .filter((t) => !t.isTransfer && t.cspBucket === "GUILT_FREE")
        .map((t) => ({
          amountCents: Math.round(Number(t.amount) * 100),
          moneyDial: t.moneyDial,
        }));
      const patterns = detectRecurringPatterns(
        auditTransactions.map((t) => ({
          id: t.id,
          postedAt: t.postedAt,
          amountCents: Math.round(Number(t.amount) * 100),
          description: t.description,
          isTransfer: false,
        }))
      );

      deep = {
        dialDrift: buildDialDriftReview(
          dials.map((d) => ({ category: d.category, level: d.level })),
          computeDialShares(guiltFree),
          DIAL_DRIFT_MIN_TRANSACTIONS
        ),
        plan,
        subscriptions: buildSubscriptionAudit(patterns),
      };
    }
  }

  return {
    current,
    beats: {
      weather,
      insight: deriveDateInsight(summary),
      action: weather.action
        ? `${weather.action.label}`
        : "Nothing needs you — enjoy it.",
    },
    deep,
    archive: archiveRows.map((row) => ({
      id: row.id,
      periodStart: row.periodStart.toISOString().slice(0, 10),
      status: row.status,
      scheduledFor: row.scheduledFor
        ? row.scheduledFor.toISOString().slice(0, 10)
        : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      presentNames: row.presentNames,
    })),
    preHistory: checkIns.map((c) => ({
      month: c.month.toISOString().slice(0, 7),
      wentWell: c.wentWell,
      feltHard: c.feltHard,
      toAdjust: c.toAdjust,
      creditWins: c.creditWins,
    })),
  };
}

/** Travel shift (#62): move the Date to a chosen evening. Moved renders
 * on the Timeline as moved-not-skipped; completing later counts as kept. */
export async function rescheduleMoneyDate(input: {
  id: string;
  /** Date-only ISO. */
  toDate: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: "Not signed in." };
  if (!DATE_ONLY.test(input.toDate)) {
    return { error: "Pick a real evening (YYYY-MM-DD)." };
  }

  const updated = await prisma.moneyDate.updateMany({
    where: { id: input.id, userId, status: { not: "COMPLETED" } },
    data: {
      status: "RESCHEDULED",
      scheduledFor: new Date(`${input.toDate}T00:00:00.000Z`),
    },
  });
  if (updated.count === 0) return { error: "That Money Date isn't open." };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/timeline");
  revalidatePath("/dashboard/money-date");
  return { ok: true };
}

export async function completeMoneyDate(input: {
  id: string;
  presentNames: string[];
  beats: MoneyDateBeats;
}): Promise<{ ok?: boolean; error?: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: "Not signed in." };

  const updated = await prisma.moneyDate.updateMany({
    where: { id: input.id, userId, status: { not: "COMPLETED" } },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      presentNames: input.presentNames.slice(0, 8).map((n) => n.slice(0, 40)),
      beats: JSON.parse(JSON.stringify(input.beats)),
    },
  });
  if (updated.count === 0) return { error: "That Money Date isn't open." };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/timeline");
  revalidatePath("/dashboard/money-date");
  return { ok: true };
}