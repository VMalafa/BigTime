// Household Weather v1 (#77): the deterministic rules behind the one-word
// home state. Pure — the action layer feeds it heartbeat output and today's
// date; every branch is unit-tested, and the Honesty Rule is structural:
// an unfunded Earmark can never read Steady.
//
// Ratified rules (the household re-ratifies at PR review):
//   Attention — Safe-to-Spend negative, or an unfunded Earmark due within
//               3 days (including past due).
//   Watch     — any unfunded Earmark in the current Pay Period, or no
//               paycheck in 40+ days on a linked household.
//   Steady    — otherwise.
// Exactly one action, from the highest-priority triggering condition;
// Steady carries none.
//
// PROPOSED (flagged for ratification): a household whose heartbeat can't
// run yet (no confirmed income stream, no paycheck landed) reads Watch —
// we don't know, and the Honesty Rule forbids claiming Steady when we
// don't know. The sentence names the missing step as the one action.

export type WeatherState = "Steady" | "Watch" | "Attention";

export interface WeatherEarmarkInput {
  name: string;
  amountCents: number;
  /** ISO date. */
  dueDate: string;
}

export interface WeatherInput {
  heartbeatAvailable: boolean;
  /** The heartbeat's own honest reason when unavailable. */
  heartbeatReason?: string | null;
  safeToSpendCents?: number;
  paycheckCents?: number;
  plannedSavingsInvestmentsCents?: number;
  /** Earmarks reserved against the current Pay Period. */
  earmarks?: WeatherEarmarkInput[];
  /** ISO date of the period-opening paycheck. */
  periodStart?: string | null;
  /** ISO date for "today" — injected so the engine stays pure. */
  today: string;
}

export interface WeatherAction {
  label: string;
  href: string;
}

export interface WeatherReading {
  state: WeatherState;
  sentence: string;
  /** Present exactly when non-Steady. */
  action: WeatherAction | null;
}

const ATTENTION_WINDOW_DAYS = 3;
const STALE_PAYCHECK_DAYS = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

interface FundedEarmark extends WeatherEarmarkInput {
  funded: boolean;
  shortfallCents: number;
}

function dayNumber(iso: string): number {
  return Math.floor(new Date(`${iso.slice(0, 10)}T00:00:00.000Z`).getTime() / DAY_MS);
}

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", timeZone: "UTC" }
  );
}

/**
 * The same funding rule the Timeline's money moments use: dues draw down
 * the period's paycheck (after the planned savings/investments share) in
 * due-date order; an Earmark the remainder can't cover is unfunded.
 */
export function fundEarmarks(input: {
  paycheckCents: number;
  plannedSavingsInvestmentsCents: number;
  earmarks: WeatherEarmarkInput[];
}): FundedEarmark[] {
  let remaining = input.paycheckCents - input.plannedSavingsInvestmentsCents;
  return [...input.earmarks]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((earmark) => {
      const funded = remaining >= earmark.amountCents;
      const shortfallCents = funded
        ? 0
        : earmark.amountCents - Math.max(0, remaining);
      remaining -= earmark.amountCents;
      return { ...earmark, funded, shortfallCents };
    });
}

export function computeWeather(input: WeatherInput): WeatherReading {
  // No heartbeat yet: we don't know, and saying Steady would be a lie.
  if (!input.heartbeatAvailable) {
    const needsIncome = (input.heartbeatReason ?? "").includes("income");
    return {
      state: "Watch",
      sentence:
        input.heartbeatReason ??
        "The heartbeat isn't running yet, so this can't read Steady.",
      action: needsIncome
        ? { label: "Confirm an income stream", href: "/dashboard/income" }
        : { label: "Check your linked accounts", href: "/settings/connections" },
    };
  }

  const safeToSpendCents = input.safeToSpendCents ?? 0;
  const funded = fundEarmarks({
    paycheckCents: input.paycheckCents ?? 0,
    plannedSavingsInvestmentsCents: input.plannedSavingsInvestmentsCents ?? 0,
    earmarks: input.earmarks ?? [],
  });
  const unfunded = funded.filter((e) => !e.funded);
  const today = dayNumber(input.today);

  // --- Attention: the truth needs you now.
  if (safeToSpendCents < 0) {
    return {
      state: "Attention",
      sentence: `Safe-to-Spend is ${formatDollars(-safeToSpendCents)} below zero this Pay Period.`,
      action: { label: "See where it went", href: "/dashboard/spending" },
    };
  }

  const dueSoon = unfunded.find(
    (e) => dayNumber(e.dueDate) - today <= ATTENTION_WINDOW_DAYS
  );
  if (dueSoon) {
    return {
      state: "Attention",
      sentence: `${dueSoon.name} is due ${formatDay(dueSoon.dueDate)} and this paycheck comes up ${formatDollars(dueSoon.shortfallCents)} short.`,
      action: {
        label: `Review the ${dueSoon.name} Earmark`,
        href: "/dashboard/timeline",
      },
    };
  }

  // --- Watch: nothing is on fire, but don't look away.
  if (unfunded.length > 0) {
    const first = unfunded[0];
    return {
      state: "Watch",
      sentence: `${first.name} (due ${formatDay(first.dueDate)}) isn't covered by this paycheck yet.`,
      action: {
        label: `Review the ${first.name} Earmark`,
        href: "/dashboard/timeline",
      },
    };
  }

  if (input.periodStart) {
    const daysSincePaycheck = today - dayNumber(input.periodStart);
    if (daysSincePaycheck >= STALE_PAYCHECK_DAYS) {
      return {
        state: "Watch",
        sentence: `No paycheck has landed in ${daysSincePaycheck} days.`,
        action: {
          label: "Check your linked accounts",
          href: "/settings/connections",
        },
      };
    }
  }

  // --- Steady: covered, and we can prove it.
  return {
    state: "Steady",
    sentence: "Everything due this Pay Period is covered.",
    action: null,
  };
}
