"use client";

// The Today strip (#79): today's and tomorrow's actionable rows in
// month-river anatomy — date label | title | chip — compact enough that
// hero + strip + Safe-to-Spend survive one hand-held screen. Rows carry
// information; the hero carries the single action (one-action discipline).

import {
  stripDayLabel,
  type StripDay,
  type TodayStripRow,
} from "@/lib/timeline/today-strip";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export function TodayStrip({
  rows,
  todayIso,
  tomorrowIso,
}: {
  rows: TodayStripRow[];
  todayIso: string;
  tomorrowIso: string;
}) {
  const days: { day: StripDay; iso: string }[] = [
    { day: "TODAY", iso: todayIso },
    { day: "TOMORROW", iso: tomorrowIso },
  ];

  return (
    <section aria-label="Today and tomorrow" className="mb-6" data-today-strip>
      {rows.length === 0 ? (
        // The variant-C empty state: quiet, and honestly earned.
        <p className="text-sm font-sans text-text-secondary text-center py-2">
          That&apos;s everything — nothing else needs you today.
        </p>
      ) : (
        <div className="space-y-3">
          {days.map(({ day, iso }) => {
            const dayRows = rows.filter((row) => row.day === day);
            if (dayRows.length === 0) return null;
            return (
              <div key={day}>
                <p className="text-xs font-sans uppercase tracking-wide text-text-secondary mb-1.5">
                  {stripDayLabel(day, iso)}
                </p>
                <div className="space-y-1.5">
                  {dayRows.map((row, index) => (
                    <div
                      key={`${row.kind}-${row.title}-${index}`}
                      data-strip-row={row.kind.toLowerCase()}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                        row.needsPickup || row.funded === false
                          ? "border-warning bg-warning/10"
                          : row.kind === "EARMARK"
                            ? "border-accent-gold/30 bg-accent-gold/5"
                            : "border-bg-secondary bg-white"
                      }`}
                    >
                      <p className="min-w-0 flex-1 font-sans text-sm text-text-primary truncate">
                        {row.title}
                        {row.costCents !== null
                          ? ` · ${formatCents(row.costCents)}`
                          : ""}
                      </p>
                      {row.chip && (
                        <span className="shrink-0 rounded-full border border-accent-gold/50 bg-accent-gold/10 px-2 py-0.5 text-xs font-sans text-text-primary">
                          {row.chip}
                        </span>
                      )}
                      {row.needsPickup && (
                        <span className="shrink-0 text-xs font-sans font-medium text-warning">
                          who&apos;s got pickup?
                        </span>
                      )}
                      {row.detail && (
                        <span
                          className={`shrink-0 text-xs font-sans ${
                            row.funded === false
                              ? "font-medium text-warning"
                              : "text-text-secondary"
                          }`}
                        >
                          {row.detail}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
