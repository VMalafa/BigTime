"use client";

// ============================================================================
// PROTOTYPE — THROWAWAY — wayfinder #27 "The One Truth: the home screen"
//
// Three structurally different takes on the one-truth Home, mounted on the
// real /dashboard route behind ?variant=A|B|C. No param → the existing page
// renders untouched. Seeded with a realistic worst-case day (Watch state:
// one unfunded Earmark, 7 uncategorized) — the Weather engine doesn't exist
// yet, so live wiring would prototype the wrong question. Read-only; every
// button is a dead end on purpose.
//
// Judged against #32/#37 decisions: Household Weather + one sentence + one
// next action; Safe-to-Spend with its Pay Period; the honest uncategorized
// chip; covered-by-default tone; a door into "where did it go".
// ============================================================================

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PrototypeSwitcher } from "@/components/shared/PrototypeSwitcher";

// --- Seed: one worst-case Thursday --------------------------------------

const SEED = {
  weather: "Watch" as const,
  sentence: "Friday's daycare Earmark isn't covered by this paycheck yet.",
  action: "Review Friday's daycare Earmark",
  safeToSpendCents: 61800,
  periodLabel: "Pay Period Jul 14 – Jul 28",
  periodDayText: "day 5 of 14",
  periodPct: 36,
  uncategorized: 7,
  earmarks: [
    { name: "Mortgage", due: "Jul 15", cents: 285000, covered: true },
    { name: "Daycare tuition", due: "Jul 24", cents: 41200, covered: false },
    { name: "Car insurance", due: "Jul 26", cents: 21400, covered: true },
  ],
  week: [
    { day: "Wed", label: "Noon Dismissal — Corbett", tag: "school", chip: null },
    { day: "Fri", label: "Daycare tuition Earmark · $412", tag: "money", chip: "unfunded" },
    { day: "Mon", label: "Payday + Money Date", tag: "money", chip: null },
  ],
};

const usd = (c: number) =>
  (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const WEATHER_STYLE: Record<string, { dot: string; band: string; text: string }> = {
  Steady: { dot: "bg-success", band: "bg-success/10 border-success/30", text: "text-success" },
  Watch: { dot: "bg-warning", band: "bg-warning/10 border-warning/40", text: "text-warning" },
  Attention: { dot: "bg-error", band: "bg-error/10 border-error/40", text: "text-error" },
};

function UncategorizedChip() {
  return (
    <Link
      href="/dashboard/spending"
      className="inline-flex items-center gap-2 rounded-full border border-bg-secondary bg-white px-3 py-1.5 text-xs text-text-secondary hover:border-accent-gold"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
      {SEED.uncategorized} transactions not yet categorized
    </Link>
  );
}

// --- Variant A — "Weather first" -----------------------------------------
// Hierarchy: the household's state IS the screen. One word, one sentence,
// one action. The number is secondary; everything else is a door.

function VariantA() {
  const w = WEATHER_STYLE[SEED.weather];
  return (
    <div className="mx-auto max-w-md px-5 py-10 min-h-[80vh] flex flex-col">
      <div className="flex-1 flex flex-col justify-center text-center">
        <div className={`mx-auto mb-4 h-3 w-3 rounded-full ${w.dot}`} />
        <h1 className={`font-serif text-6xl mb-3 ${w.text}`}>{SEED.weather}</h1>
        <p className="text-text-primary text-base mb-6 leading-relaxed">{SEED.sentence}</p>
        <button className="mx-auto rounded-full bg-text-primary text-white px-6 py-3 text-sm font-medium">
          {SEED.action} →
        </button>
      </div>
      <div className="mt-10 rounded-xl bg-white border border-bg-secondary p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-text-secondary mb-1">Safe-to-Spend</p>
        <p className="font-serif text-3xl text-accent-gold">{usd(SEED.safeToSpendCents)}</p>
        <p className="text-xs text-text-secondary mt-1">{SEED.periodLabel}</p>
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <UncategorizedChip />
        <Link href="/dashboard/spending" className="text-xs text-text-secondary underline underline-offset-4">
          where did it go →
        </Link>
      </div>
      {/* Deliberately absent: debt totals, income cards, charts, bonuses. */}
    </div>
  );
}

// --- Variant B — "Number first" ------------------------------------------
// Hierarchy: Safe-to-Spend is the single leading number, full stop. Weather
// is a thin honest band above it; the Earmark peek shows covered-by-default.

function VariantB() {
  const w = WEATHER_STYLE[SEED.weather];
  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <div className={`mb-6 rounded-lg border px-4 py-2.5 flex items-center gap-2.5 ${w.band}`}>
        <span className={`h-2 w-2 rounded-full ${w.dot} shrink-0`} />
        <p className="text-sm text-text-primary leading-snug">
          <span className={`font-semibold ${w.text}`}>{SEED.weather}.</span> {SEED.sentence}{" "}
          <button className="underline underline-offset-2 font-medium">Fix it</button>
        </p>
      </div>

      <p className="text-xs uppercase tracking-wide text-text-secondary">Safe-to-Spend</p>
      <p className="font-serif text-7xl text-text-primary my-1">{usd(SEED.safeToSpendCents)}</p>
      <div className="mb-1 h-1.5 rounded-full bg-bg-secondary overflow-hidden">
        <div className="h-full bg-accent-gold" style={{ width: `${SEED.periodPct}%` }} />
      </div>
      <p className="text-xs text-text-secondary mb-8">
        {SEED.periodLabel} · {SEED.periodDayText}
      </p>

      <div className="rounded-xl bg-white border border-bg-secondary divide-y divide-bg-secondary mb-4">
        {SEED.earmarks.map((e) => (
          <div key={e.name} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm text-text-primary">{e.name}</p>
              <p className="text-xs text-text-secondary">due {e.due}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-text-primary">{usd(e.cents)}</p>
              {e.covered ? (
                <p className="text-xs text-success">covered ✓</p>
              ) : (
                <p className="text-xs font-semibold text-warning">not covered yet</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <UncategorizedChip />
        <Link href="/dashboard/spending" className="text-xs text-text-secondary underline underline-offset-4">
          where did it go →
        </Link>
      </div>
      {/* Deliberately absent: weather as hero, week preview, debt/income cards. */}
    </div>
  );
}

// --- Variant C — "Glance list" -------------------------------------------
// Hierarchy: Home leans toward the Timeline — one compact header row holds
// the whole money truth; the body is the next few days. Tests whether Home
// and the Sunday scan want to converge.

function VariantC() {
  const w = WEATHER_STYLE[SEED.weather];
  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <div className="mb-6 rounded-xl bg-white border border-bg-secondary px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${w.dot}`} />
          <div>
            <p className={`text-sm font-semibold ${w.text}`}>{SEED.weather}</p>
            <p className="text-[11px] text-text-secondary">{SEED.periodLabel}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-serif text-2xl text-accent-gold leading-none">{usd(SEED.safeToSpendCents)}</p>
          <p className="text-[11px] text-text-secondary mt-0.5">safe to spend</p>
        </div>
      </div>

      <div className={`mb-6 rounded-lg border px-4 py-2.5 ${w.band}`}>
        <p className="text-sm text-text-primary">
          {SEED.sentence}{" "}
          <button className="font-medium underline underline-offset-2">{SEED.action}</button>
        </p>
      </div>

      <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">This week</p>
      <div className="rounded-xl bg-white border border-bg-secondary divide-y divide-bg-secondary mb-4">
        {SEED.week.map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-3">
            <span className="w-10 text-xs font-semibold text-text-secondary">{r.day}</span>
            <span className="flex-1 text-sm text-text-primary">{r.label}</span>
            {r.tag === "school" && (
              <span className="rounded-md bg-cat-plum/10 text-cat-plum text-[10px] font-bold uppercase px-2 py-0.5">
                school
              </span>
            )}
            {r.chip === "unfunded" && (
              <span className="rounded-md bg-warning/15 text-warning text-[10px] font-bold uppercase px-2 py-0.5">
                not covered
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <UncategorizedChip />
        <Link href="/dashboard/spending" className="text-xs text-text-secondary underline underline-offset-4">
          where did it go →
        </Link>
      </div>
      {/* Deliberately absent: big hero number/word — everything shares one glance. */}
    </div>
  );
}

// --- Gate ----------------------------------------------------------------

const LABELS: Record<string, string> = {
  A: "Weather first",
  B: "Number first",
  C: "Glance list",
};

function Gate({ children }: { children: ReactNode }) {
  const variant = useSearchParams().get("variant");
  if (variant !== "A" && variant !== "B" && variant !== "C") return <>{children}</>;
  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      <PrototypeSwitcher variants={["A", "B", "C"]} labels={LABELS} />
    </>
  );
}

export function OneTruthPrototype({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
