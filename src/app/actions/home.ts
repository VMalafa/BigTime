"use server";

// The one-truth Home's single read (#77): heartbeat + derived Household
// Weather + the honest uncategorized count, computed fresh from the
// database on every load. The Weather rules themselves are pure
// (src/lib/heartbeat/weather.ts); this action only feeds them.

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getHeartbeat, type HeartbeatData } from "@/app/actions/heartbeat";
import {
  computeWeather,
  type WeatherReading,
} from "@/lib/heartbeat/weather";
import { monthKeyFor, monthRange } from "@/lib/spending/month-summary";

export interface HomeTruth {
  heartbeat: HeartbeatData;
  weather: WeatherReading;
  /** Same predicate as the Spending page's honest chip: this calendar
   * month, non-transfer, outgoing, UNCATEGORIZED. */
  uncategorizedCount: number;
}

export async function getHomeTruth(): Promise<HomeTruth | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  const { start, endExclusive } = monthRange(monthKeyFor(now));

  const [heartbeat, uncategorizedCount] = await Promise.all([
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
  ]);

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

  return { heartbeat, weather, uncategorizedCount };
}
