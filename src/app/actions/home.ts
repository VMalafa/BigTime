"use server";

// The one-truth Home's single read (#77, extended by #79): heartbeat +
// derived Household Weather + the honest uncategorized count + the Today
// strip, computed fresh from the database on every load. The rules
// themselves are pure (src/lib/heartbeat/weather.ts,
// src/lib/timeline/today-strip.ts); this action only feeds them.

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getHeartbeat, type HeartbeatData } from "@/app/actions/heartbeat";
import {
  computeWeather,
  fundEarmarks,
  type WeatherReading,
} from "@/lib/heartbeat/weather";
import {
  buildTodayStrip,
  type TodayStripRow,
} from "@/lib/timeline/today-strip";
import { monthKeyFor, monthRange } from "@/lib/spending/month-summary";

export interface HomeTruth {
  heartbeat: HeartbeatData;
  weather: WeatherReading;
  /** Same predicate as the Spending page's honest chip: this calendar
   * month, non-transfer, outgoing, UNCATEGORIZED. */
  uncategorizedCount: number;
  /** Today's and tomorrow's actionable rows (#79). */
  strip: TodayStripRow[];
  /** Date-only ISO for today/tomorrow — the strip labels carry the date. */
  todayIso: string;
  tomorrowIso: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getHomeTruth(): Promise<HomeTruth | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const tomorrowUtc = new Date(todayUtc.getTime() + DAY_MS);
  const todayIso = todayUtc.toISOString().slice(0, 10);
  const { start, endExclusive } = monthRange(monthKeyFor(now));

  const [heartbeat, uncategorizedCount, windowEvents] = await Promise.all([
    getHeartbeat(),
    prisma.feedTransaction.count({
      where: {
        linkedAccount: { connection: { userId: user.id } },
        postedAt: { gte: start, lt: endExclusive },
        isTransfer: false,
        amount: { lt: 0 },
        cspBucket: "UNCATEGORIZED",
      },
    }),
    // CONFIRMED Events touching today or tomorrow (exclusive-end aware);
    // the pure strip builder does the precise per-day selection.
    prisma.event.findMany({
      where: {
        calendarSource: { userId: user.id },
        status: "CONFIRMED",
        startDate: { lte: tomorrowUtc },
        OR: [
          { endDate: null, startDate: { gte: todayUtc } },
          { endDate: { gt: todayUtc } },
        ],
      },
      include: { profile: { select: { name: true } } },
      orderBy: [{ startDate: "asc" }, { normalizedTitle: "asc" }],
    }),
  ]);

  // Current-period Earmarks with funded state, same drawdown rule as the
  // Weather engine and the Timeline's money moments.
  const fundedEarmarks = heartbeat.available
    ? fundEarmarks({
        paycheckCents: heartbeat.paycheckCents ?? 0,
        plannedSavingsInvestmentsCents:
          heartbeat.plannedSavingsInvestmentsCents ?? 0,
        earmarks: (heartbeat.earmarks ?? []).map((e) => ({
          name: e.name,
          amountCents: e.amountCents,
          dueDate: e.dueDate.slice(0, 10),
        })),
      })
    : [];

  const strip = buildTodayStrip({
    events: windowEvents.map((event) => ({
      id: event.id,
      date: event.startDate.toISOString().slice(0, 10),
      endDate: event.endDate ? event.endDate.toISOString().slice(0, 10) : null,
      title: event.title,
      category: event.category,
      costCents: event.costCents,
      profileName: event.profile?.name ?? null,
      assigneeExtra: event.assigneeExtra,
    })),
    earmarks: fundedEarmarks,
    todayIso,
  });

  const weather = computeWeather({
    heartbeatAvailable: heartbeat.available,
    heartbeatReason: heartbeat.reason ?? null,
    safeToSpendCents: heartbeat.safeToSpendCents,
    paycheckCents: heartbeat.paycheckCents,
    plannedSavingsInvestmentsCents: heartbeat.plannedSavingsInvestmentsCents,
    earmarks: heartbeat.earmarks,
    periodStart: heartbeat.periodStart ?? null,
    unassignedQuirk: strip.unassignedQuirk,
    today: todayIso,
  });

  return {
    heartbeat,
    weather,
    uncategorizedCount,
    strip: strip.rows,
    todayIso,
    tomorrowIso: tomorrowUtc.toISOString().slice(0, 10),
  };
}
