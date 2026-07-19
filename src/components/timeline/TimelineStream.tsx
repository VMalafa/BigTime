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
import { buildIcsExport } from "@/lib/timeline/ics-export";
import {
  EXTRA_ASSIGNEES,
  assigneeChipLabel,
  matchesPersonFilter,
  type ExtraAssignee,
} from "@/lib/timeline/assignee";
import {
  assignEventPerson,
  dismissEvent,
  markRenewalHandled,
} from "@/app/actions/events";
import {
  isRenewalEvent,
  pickLoudRenewal,
  renewalDetail,
  renewalState,
} from "@/lib/renewals/radar";
import { Button } from "@/components/ui/Button";

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
  assigneeExtra: ExtraAssignee | null;
  /** Renewal radar (#70): set = this renewal is handled and quiet. */
  handledAt: string | null;
}

/** The assignable slice of an Event — server truth or optimistic override. */
interface Assignment {
  profileId: string | null;
  profileName: string | null;
  assigneeExtra: ExtraAssignee | null;
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
  todayIso,
  horizon,
}: {
  events: TimelineEventItem[];
  moments: MoneyMoment[];
  sources: TimelineFilterSource[];
  people: TimelinePerson[];
  rhythmNote: string | null;
  /** Date-only ISO — injected so renewal lead-time state stays pure. */
  todayIso: string;
  /** "🌺 Hawaii · 34% funded" — the river always ends on the goal (#86). */
  horizon?: string | null;
}) {
  // Chip state: everything on by default; a chip toggles its slice out.
  const [mutedCategories, setMutedCategories] = useState<Set<string>>(
    new Set()
  );
  const [mutedMoney, setMutedMoney] = useState<Set<string>>(new Set());
  const [person, setPerson] = useState<string>("ALL");
  // Export selection (#58): Events only — money moments stay in-app in v1.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Person chips (#72): optimistic overrides on top of server truth, and
  // which card's picker is open. Awaited per-intent action + rollback.
  const [assignments, setAssignments] = useState<Map<string, Assignment>>(
    new Map()
  );
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const effectiveAssignment = (event: TimelineEventItem): Assignment =>
    assignments.get(event.id) ?? {
      profileId: event.profileId,
      profileName: event.profileName,
      assigneeExtra: event.assigneeExtra,
    };

  async function assign(event: TimelineEventItem, next: Assignment) {
    const previous = effectiveAssignment(event);
    setPickerFor(null);
    setAssignments((current) => new Map(current).set(event.id, next));
    try {
      const result = await assignEventPerson(
        event.id,
        next.profileId
          ? { kind: "PROFILE", profileId: next.profileId }
          : next.assigneeExtra
            ? { kind: "EXTRA", extra: next.assigneeExtra }
            : null
      );
      if (result.error) throw new Error(result.error);
    } catch {
      // Rollback (#29): a failed write may never leave a chip standing —
      // that would be a lie about who's got it.
      setAssignments((current) => new Map(current).set(event.id, previous));
    }
  }

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

  // Renewal radar (#70): optimistic handled/dismissed sets + the
  // no-stacking loud pick — exactly one escalated renewal goes loud.
  const [renewalHandled, setRenewalHandled] = useState<Set<string>>(new Set());
  const [renewalDismissed, setRenewalDismissed] = useState<Set<string>>(
    new Set()
  );

  const renewalInput = (e: TimelineEventItem) => ({
    id: e.id,
    date: e.date,
    category: e.category,
    handledAt: renewalHandled.has(e.id)
      ? new Date().toISOString()
      : e.handledAt,
  });

  const visibleForRadar = events.filter((e) => !renewalDismissed.has(e.id));
  const loudRenewalId = pickLoudRenewal(
    visibleForRadar.map(renewalInput),
    todayIso
  );

  async function actOnRenewal(id: string, act: "done" | "dismiss") {
    if (act === "done") {
      setRenewalHandled((current) => new Set(current).add(id));
      const result = await markRenewalHandled(id);
      if (result.error) {
        setRenewalHandled((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    } else {
      setRenewalDismissed((current) => new Set(current).add(id));
      const result = await dismissEvent(id);
      if (result.error) {
        setRenewalDismissed((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    }
  }

  const rows: Row[] = [
    ...events
      .filter((e) => !renewalDismissed.has(e.id))
      .filter(
        (e) => !mutedCategories.has(categoryKey(e.sourceId, e.category))
      )
      .filter((e) => matchesPersonFilter(person, effectiveAssignment(e)))
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

  // Export honors the current filters: only visible, selected Events go.
  const visibleEvents = rows.flatMap((row) =>
    row.type === "event" ? [row.event] : []
  );
  const exportableEvents = visibleEvents.filter((e) => selected.has(e.id));

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDownload() {
    if (exportableEvents.length === 0) return;
    // One source selected → its name, so a re-import lands on the same
    // Calendar Source and the natural-key dedup raises nothing new.
    const sourceIds = new Set(exportableEvents.map((e) => e.sourceId));
    const calendarName =
      sourceIds.size === 1
        ? (exportableEvents[0]?.sourceName ?? "Household Timeline")
        : "Household Timeline";
    const ics = buildIcsExport({
      calendarName,
      events: exportableEvents.map((e) => ({
        startDate: e.date,
        endDate: e.endDate,
        title: e.title,
        note: e.note,
      })),
      now: new Date(),
    });
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "household-timeline.ics";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-6">
      {/* --- Filter chips --- */}
      <div className="space-y-2">
        {(people.length > 0 || events.length > 0) && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-sans text-text-secondary">Who</span>
            {[{ id: "ALL", name: "Everyone" }, ...people, ...EXTRA_ASSIGNEES].map((p) => (
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

      {/* --- Export toolbar (#58): Events only, honors filters --- */}
      {visibleEvents.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white border border-bg-secondary px-4 py-2.5">
          <span className="text-sm font-sans text-text-secondary">
            {exportableEvents.length} selected for export
          </span>
          <button
            type="button"
            onClick={() =>
              setSelected(new Set(visibleEvents.map((e) => e.id)))
            }
            className="text-sm font-sans text-accent-gold hover:underline"
          >
            Select visible
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm font-sans text-text-secondary hover:underline"
          >
            Clear
          </button>
          <div className="ml-auto">
            <Button
              variant="secondary"
              size="sm"
              disabled={exportableEvents.length === 0}
              onClick={handleDownload}
            >
              Download .ics
            </Button>
          </div>
        </div>
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
            {group.map((row, index) => {
              if (row.type !== "event") return renderMoment(row, index);
              // Renewal lead-time styling (#70): loud only for the single
              // picked escalated renewal; upcoming reads as a quiet tint.
              const rState = isRenewalEvent(row.event)
                ? renewalState(renewalInput(row.event), todayIso)
                : null;
              const loud =
                rState === "ESCALATED" && loudRenewalId === row.event.id;
              const rDetail = rState
                ? renewalDetail(renewalInput(row.event), todayIso)
                : null;
              return (
                <div
                  key={row.event.id}
                  data-timeline-kind="event"
                  data-renewal-state={
                    rState
                      ? loud
                        ? "escalated-loud"
                        : rState.toLowerCase()
                      : undefined
                  }
                  className={`flex gap-3 rounded-lg border px-4 py-3 ${
                    loud
                      ? "border-warning bg-warning/10"
                      : rState === "UPCOMING" || rState === "ESCALATED"
                        ? "border-accent-gold/40 bg-accent-gold/5"
                        : "bg-white border-bg-secondary"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-[#b08d2f] cursor-pointer"
                    aria-label={`Select ${row.event.title} for export`}
                    checked={selected.has(row.event.id)}
                    onChange={() => toggleSelected(row.event.id)}
                  />
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
                      {row.event.costCents !== null
                        ? ` · ${formatCents(row.event.costCents)}`
                        : ""}
                      {row.event.note ? (
                        <span className="italic"> · {row.event.note}</span>
                      ) : null}
                    </p>
                    {/* Person chip (#72): assign/clear in two taps. */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {(() => {
                        const assignment = effectiveAssignment(row.event);
                        const label = assigneeChipLabel(assignment);
                        return (
                          <button
                            type="button"
                            aria-label={
                              label
                                ? `${row.event.title} assigned to ${label} — change`
                                : `Assign ${row.event.title}`
                            }
                            onClick={() =>
                              setPickerFor((current) =>
                                current === row.event.id ? null : row.event.id
                              )
                            }
                            className={`rounded-full border px-2 py-0.5 text-xs font-sans transition-colors ${
                              label
                                ? "border-accent-gold/50 bg-accent-gold/10 text-text-primary"
                                : "border-dashed border-bg-secondary text-text-secondary hover:border-accent-gold/50"
                            }`}
                          >
                            {label ?? "+ assign"}
                          </button>
                        );
                      })()}
                      {pickerFor === row.event.id && (
                        <span
                          role="group"
                          aria-label={`Assign ${row.event.title} to`}
                          className="flex flex-wrap items-center gap-1.5"
                        >
                          {[
                            ...people,
                            ...EXTRA_ASSIGNEES.map((extra) => ({
                              id: extra.id,
                              name: extra.name,
                            })),
                          ].map((choice) => (
                            <button
                              key={choice.id}
                              type="button"
                              onClick={() =>
                                assign(
                                  row.event,
                                  people.some((p) => p.id === choice.id)
                                    ? {
                                        profileId: choice.id,
                                        profileName: choice.name,
                                        assigneeExtra: null,
                                      }
                                    : {
                                        profileId: null,
                                        profileName: null,
                                        assigneeExtra:
                                          choice.id as ExtraAssignee,
                                      }
                                )
                              }
                              className="rounded-full border border-bg-secondary bg-white px-2 py-0.5 text-xs font-sans text-text-primary hover:border-accent-gold transition-colors"
                            >
                              {choice.name}
                            </button>
                          ))}
                          {assigneeChipLabel(effectiveAssignment(row.event)) && (
                            <button
                              type="button"
                              onClick={() =>
                                assign(row.event, {
                                  profileId: null,
                                  profileName: null,
                                  assigneeExtra: null,
                                })
                              }
                              className="rounded-full border border-bg-secondary bg-white px-2 py-0.5 text-xs font-sans text-text-secondary hover:border-error/60 transition-colors"
                            >
                              No one
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                    {/* Renewal lead-time line (#70): the escalated loud
                        card carries the one next action; everything else
                        stays a quiet caption. */}
                    {rDetail && (
                      <p
                        className={`text-xs font-sans mt-1 ${
                          loud
                            ? "font-medium text-warning"
                            : "text-text-secondary"
                        }`}
                      >
                        {rDetail}
                      </p>
                    )}
                    {loud && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => actOnRenewal(row.event.id, "done")}
                          className="rounded-full border border-warning bg-white px-3 py-0.5 text-xs font-sans font-medium text-text-primary hover:bg-warning/10 transition-colors"
                        >
                          Done
                        </button>
                        <button
                          type="button"
                          onClick={() => actOnRenewal(row.event.id, "dismiss")}
                          className="rounded-full border border-bg-secondary bg-white px-3 py-0.5 text-xs font-sans text-text-secondary hover:border-error/60 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* The horizon (#86): every scan ends on what it's all for. */}
      {horizon && (
        <div
          data-timeline-horizon
          className="rounded-xl border border-accent-gold/50 bg-accent-gold/10 px-5 py-4 text-center"
        >
          <p className="font-serif text-lg text-accent-gold">{horizon}</p>
        </div>
      )}
    </div>
  );

  function renderMoment(
    row: Extract<Row, { type: "moment" }>,
    index: number
  ) {
    return (
      <div
        key={`${row.moment.kind}-${row.moment.date}-${index}`}
        data-timeline-kind={row.moment.kind.toLowerCase()}
        className={`flex gap-3 rounded-lg border px-4 py-3 ${
          row.moment.kind === "EARMARK_DUE" && row.moment.funded === false
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
    );
  }
}
