"use client";

// The merged stream (#56): month-grouped agenda — the Corbett scheduler's
// proven shape — with person and category filter chips. Money moments are
// visually distinct from life Events without shouting; covered-by-default
// styling per #37 (funded due dates read as settled rhythm, an unfunded
// one escalates with exactly one next action). Pure presentation: all data
// arrives server-derived; filters are UI state only.

import { useState } from "react";
import Link from "next/link";
import type { MoneyMoment } from "@/lib/timeline/money-moments";

export interface TimelineEventItem {
  id: string;
  /** Date-only ISO. */
  date: string;
  /** Exclusive end; null = single-day. */
  endDate: string | null;
  title: string;
  category: string;
  note: string | null;
  costCents: number | null;
  sourceId: string;
  sourceName: string;
  profileId: string | null;
  profileName: string | null;
}

export interface TimelineFilterSource {
  id: string;
  name: string;
  categories: string[];
}

export interface TimelinePerson {
  id: string;
  name: string;
}

const MONEY_CHIPS: { key: MoneyMoment["kind"]; label: string }[] = [
  { key: "PAYDAY", label: "Paydays" },
  { key: "EARMARK_DUE", label: "Due dates" },
  { key: "MONEY_DATE", label: "Money Dates" },
];

function formatRange(startIso: string, endIso: string | null): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };
  const start = new Date(`${startIso}T00:00:00.000Z`);
  let label = start.toLocaleDateString("en-US", options);
  if (endIso) {
    const end = new Date(`${endIso}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() - 1);
    label += ` – ${end.toLocaleDateString("en-US", options)}`;
  }
  return label;
}

function monthTitle(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

type Row =
  | { type: "event"; date: string; event: TimelineEventItem }
  | { type: "moment"; date: string; moment: MoneyMoment };

export function TimelineStream({
  events,
  moments,
  sources,
  people,
  rhythmNote,
}: {
  events: TimelineEventItem[];
  moments: MoneyMoment[];
  sources: TimelineFilterSource[];
  people: TimelinePerson[];
  rhythmNote: string | null;
}) {
  // Chip state: everything on by default; a chip toggles its slice out.
  const [mutedCategories, setMutedCategories] = useState<Set<string>>(
    new Set()
  );
  const [mutedMoney, setMutedMoney] = useState<Set<string>>(new Set());
  const [person, setPerson] = useState<string>("ALL");

  const categoryKey = (sourceId: string, category: string) =>
    `${sourceId}:${category}`;

  function toggleCategory(key: string) {
    setMutedCategories((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleMoney(kind: string) {
    setMutedMoney((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  const rows: Row[] = [
    ...events
      .filter(
        (e) => !mutedCategories.has(categoryKey(e.sourceId, e.category))
      )
      .filter(
        (e) => person === "ALL" || e.profileId === null || e.profileId === person
      )
      .map((e): Row => ({ type: "event", date: e.date, event: e })),
    ...moments
      .filter((m) => !mutedMoney.has(m.kind))
      .map((m): Row => ({ type: "moment", date: m.date, moment: m })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const months = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row.date.slice(0, 7);
    const group = months.get(key) ?? [];
    group.push(row);
    months.set(key, group);
  }

  const hasAnything = events.length > 0 || moments.length > 0;

  return (
    <div className="space-y-6">
      {/* --- Filter chips --- */}
      <div className="space-y-2">
        {people.length > 1 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-sans text-text-secondary">Who</span>
            {[{ id: "ALL", name: "Everyone" }, ...people].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPerson(p.id)}
                className={`rounded-full border px-3 py-1 text-sm font-sans transition-colors ${
                  person === p.id
                    ? "border-accent-gold bg-accent-gold/10 text-accent-gold"
                    : "border-bg-secondary bg-white text-text-secondary hover:border-accent-gold/50"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          {sources.map((source) =>
            source.categories.map((category) => {
              const key = categoryKey(source.id, category);
              const muted = mutedCategories.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleCategory(key)}
                  aria-pressed={!muted}
                  title={`${source.name} · ${category}`}
                  className={`rounded-full border px-3 py-1 text-sm font-sans transition-colors ${
                    muted
                      ? "border-bg-secondary bg-bg-secondary/50 text-text-secondary/60 line-through"
                      : "border-bg-secondary bg-white text-text-primary hover:border-accent-gold/50"
                  }`}
                >
                  {category}
                </button>
              );
            })
          )}
          {MONEY_CHIPS.map((chip) => {
            const muted = mutedMoney.has(chip.key);
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => toggleMoney(chip.key)}
                aria-pressed={!muted}
                className={`rounded-full border px-3 py-1 text-sm font-sans transition-colors ${
                  muted
                    ? "border-bg-secondary bg-bg-secondary/50 text-text-secondary/60 line-through"
                    : "border-accent-gold/40 bg-accent-gold/5 text-text-primary hover:border-accent-gold"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {rhythmNote && (
        <p className="text-sm text-text-secondary font-sans" role="status">
          {rhythmNote}
        </p>
      )}

      {!hasAnything && (
        <div className="rounded-lg bg-bg-secondary/40 p-8 text-center space-y-2">
          <p className="font-serif text-lg text-text-primary">
            Nothing on the timeline yet.
          </p>
          <p className="text-sm text-text-secondary font-sans">
            <Link
              href="/dashboard/calendar"
              className="text-accent-gold hover:underline"
            >
              Import a school calendar
            </Link>{" "}
            or add an event by hand, and confirm an income stream for the
            money rhythm.
          </p>
        </div>
      )}

      {/* --- Month-grouped agenda --- */}
      {[...months.entries()].map(([monthKey, group]) => (
        <section key={monthKey} aria-label={monthTitle(`${monthKey}-01`)}>
          <h2 className="font-serif text-xl text-text-primary mb-3 sticky top-0 bg-bg-primary/95 backdrop-blur-sm py-1">
            {monthTitle(`${monthKey}-01`)}
          </h2>
          <div className="space-y-2">
            {group.map((row, index) =>
              row.type === "event" ? (
                <div
                  key={row.event.id}
                  data-timeline-kind="event"
                  className="flex gap-3 rounded-lg bg-white border border-bg-secondary px-4 py-3"
                >
                  <div className="w-28 shrink-0 text-sm font-sans text-text-secondary pt-0.5">
                    {formatRange(row.event.date, row.event.endDate)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-medium text-text-primary">
                      {row.event.title}
                    </p>
                    <p className="text-xs text-text-secondary font-sans">
                      <span className="rounded-full bg-bg-secondary px-2 py-0.5">
                        {row.event.category}
                      </span>
                      {row.event.profileName ? ` · ${row.event.profileName}` : ""}
                      {row.event.costCents !== null
                        ? ` · ${formatCents(row.event.costCents)}`
                        : ""}
                      {row.event.note ? (
                        <span className="italic"> · {row.event.note}</span>
                      ) : null}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  key={`${row.moment.kind}-${row.moment.date}-${index}`}
                  data-timeline-kind={row.moment.kind.toLowerCase()}
                  className={`flex gap-3 rounded-lg border px-4 py-3 ${
                    row.moment.kind === "EARMARK_DUE" &&
                    row.moment.funded === false
                      ? "border-warning bg-warning/10"
                      : "border-accent-gold/30 bg-accent-gold/5"
                  }`}
                >
                  <div className="w-28 shrink-0 text-sm font-sans text-text-secondary pt-0.5">
                    {formatRange(row.moment.date, null)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-medium text-text-primary">
                      {row.moment.title}
                      {row.moment.amountCents !== undefined
                        ? ` · ${formatCents(row.moment.amountCents)}`
                        : ""}
                    </p>
                    {row.moment.detail && (
                      <p className="text-xs text-text-secondary font-sans">
                        {row.moment.detail}
                      </p>
                    )}
                    {row.moment.nextAction && (
                      <p className="text-xs font-sans font-medium text-warning mt-1">
                        → {row.moment.nextAction}
                      </p>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
