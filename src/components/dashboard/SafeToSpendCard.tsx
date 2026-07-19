"use client";

import type { HeartbeatData } from "@/app/actions/heartbeat";
import { formatCurrency } from "@/lib/utils/format";

// Safe-to-Spend (CONTEXT.md): the single leading number — the current Pay
// Period's paycheck minus its Earmarks and planned savings/investments.
// Purely presentational since #79: Home's one read (getHomeTruth) computes
// the heartbeat once and passes it down — the card fetching its own copy
// doubled the most expensive query path on every glance.

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function SafeToSpendCard({ data }: { data: HeartbeatData | null }) {
  if (!data) return null;

  if (!data.available) {
    // Only worth surfacing when the household is one step away (signed in,
    // reason present); anonymous dashboards just skip the card.
    if (!data.reason || data.reason === "Not signed in.") return null;
    return (
      <div className="rounded-lg bg-white border border-bg-secondary p-5 mb-8">
        <p className="text-xs text-text-secondary font-sans uppercase tracking-wide mb-1">
          Safe-to-Spend
        </p>
        <p className="text-sm text-text-secondary font-sans">{data.reason}</p>
      </div>
    );
  }

  const negative = (data.safeToSpendCents ?? 0) < 0;

  return (
    <div className="rounded-lg bg-white border border-accent-gold/50 p-5 mb-8">
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-xs text-text-secondary font-sans uppercase tracking-wide">
          Safe-to-Spend
        </p>
        <p className="text-xs text-text-secondary font-sans">
          {data.manualFuel
            ? `This month, from your stated income`
            : `Pay Period ${dateLabel(data.periodStart!)} – ${dateLabel(data.periodEnd!)}${data.projectedEnd ? " (next paycheck expected)" : ""}`}
        </p>
      </div>
      <p
        className={`font-serif text-4xl ${negative ? "text-error" : "text-accent-gold"}`}
      >
        {formatCurrency((data.safeToSpendCents ?? 0) / 100)}
      </p>
      <p className="text-xs text-text-secondary font-sans mt-1">
        {formatCurrency((data.paycheckCents ?? 0) / 100)} paycheck −{" "}
        {formatCurrency((data.earmarkedCents ?? 0) / 100)} Earmarked −{" "}
        {formatCurrency((data.plannedSavingsInvestmentsCents ?? 0) / 100)}{" "}
        planned savings & investments
      </p>

      {(data.earmarks?.length ?? 0) > 0 && (
        <ul className="mt-3 space-y-1 border-t border-bg-secondary pt-3">
          {data.earmarks!.map((earmark) => (
            <li
              key={`${earmark.name}-${earmark.dueDate}`}
              className="flex items-baseline justify-between font-sans text-xs"
            >
              <span className="text-text-primary">
                {earmark.name}
                <span className="text-text-secondary">
                  {" "}
                  · due {dateLabel(earmark.dueDate)}
                </span>
              </span>
              <span className="text-text-secondary">
                {formatCurrency(earmark.amountCents / 100)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {(data.undated?.length ?? 0) > 0 && (
        <p className="text-xs text-text-secondary font-sans mt-2">
          No due date detected yet for:{" "}
          {data.undated!.map((u) => u.name).join(", ")} — not reserved against
          this period.
        </p>
      )}
    </div>
  );
}
