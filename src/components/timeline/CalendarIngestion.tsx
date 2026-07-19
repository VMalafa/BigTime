"use client";

// Calendar ingestion & review client (#55). Reuses the tiered Proposal UX:
// clear-cut single-day drafts bundle into one confirm-all; multi-day
// ranges ask individually. Every mutation is an awaited per-intent server
// action with optimistic status + rollback — no zustand, no localStorage.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { confirmEvents, dismissEvent } from "@/app/actions/events";
import { importIcsCalendar } from "@/app/actions/calendar";
import { partitionDraftTiers } from "@/lib/timeline/ingestion";
import { normalizeEventTitle } from "@/lib/timeline/natural-key";
import { ManualEventForm } from "@/components/timeline/ManualEventForm";
import { ExtractCalendarPanel } from "@/components/timeline/ExtractCalendarPanel";
import { formatCurrency } from "@/lib/utils/format";

export interface SerializedEvent {
  id: string;
  /** Date-only ISO. */
  startDate: string;
  /** Exclusive end; null = single-day. */
  endDate: string | null;
  title: string;
  category: string;
  note: string | null;
  costCents: number | null;
  status: "DRAFT" | "CONFIRMED" | "DISMISSED";
}

export interface SerializedSource {
  id: string;
  name: string;
  kind: "IMPORT_PHOTO" | "IMPORT_ICS" | "MANUAL" | "EMAIL_FORWARD";
  sourceStamp: string | null;
  categories: string[];
  events: SerializedEvent[];
}

/** Inclusive human-readable range for an exclusive stored end. */
export function formatEventDate(startIso: string, endIso: string | null): string {
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

type StatusOverride = Partial<Record<string, "CONFIRMED" | "DISMISSED">>;

export function CalendarIngestion({ sources }: { sources: SerializedSource[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Optimistic status overlays on top of the server-rendered props;
  // router.refresh() re-syncs after each successful intent.
  const [overrides, setOverrides] = useState<StatusOverride>({});
  // Extraction-session attention keys (#57): natural keys the model was
  // unsure about (below the confidence floor). Ephemeral — after a reload
  // the shape rules alone govern tiering.
  const [attentionKeys, setAttentionKeys] = useState<Set<string>>(new Set());

  const statusOf = (event: SerializedEvent) =>
    overrides[event.id] ?? event.status;

  async function handleFileChosen(file: File) {
    setImporting(true);
    setImportSummary(null);
    setError(null);
    const icsText = await file.text();
    const result = await importIcsCalendar({ fileName: file.name, icsText });
    setImporting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    const parts = [
      `${result.created} new draft${result.created === 1 ? "" : "s"}`,
      `${result.alreadyKnown} already known`,
    ];
    if (result.skipped > 0) parts.push(`${result.skipped} outside the subset`);
    setImportSummary(`${result.sourceName}: ${parts.join(", ")}.`);
    router.refresh();
  }

  async function confirmIds(ids: string[]) {
    if (ids.length === 0) return;
    setError(null);
    const previous = overrides;
    setOverrides((current) => ({
      ...current,
      ...Object.fromEntries(ids.map((id) => [id, "CONFIRMED" as const])),
    }));
    const result = await confirmEvents(ids);
    if (result.error) {
      setOverrides(previous);
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function dismissOne(id: string) {
    setError(null);
    const previous = overrides;
    setOverrides((current) => ({ ...current, [id]: "DISMISSED" as const }));
    const result = await dismissEvent(id);
    if (result.error) {
      setOverrides(previous);
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const manualSource = sources.find((s) => s.kind === "MANUAL");

  return (
    <div className="space-y-8">
      {/* --- Import --- */}
      <Card padding="lg">
        <h2 className="font-serif text-xl text-text-primary mb-1">
          Import a calendar file
        </h2>
        <p className="text-sm text-text-secondary font-sans mb-4 max-w-2xl">
          All-day events from an .ics file — the format your calendar apps
          export. Re-importing an updated file only raises what&apos;s
          genuinely new; anything you dismissed stays dismissed.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ics,text/calendar"
          aria-label="Calendar file"
          disabled={importing}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileChosen(file);
            e.target.value = "";
          }}
          className="block w-full text-sm text-text-secondary font-sans file:mr-4 file:rounded-lg file:border-0 file:bg-accent-gold file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-accent-gold/90 file:cursor-pointer"
        />
        {importing && (
          <p className="mt-3 text-sm text-text-secondary font-sans">
            Importing…
          </p>
        )}
        {importSummary && (
          <p className="mt-3 text-sm text-text-primary font-sans" role="status">
            {importSummary}
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-600 font-sans" role="alert">
            {error}
          </p>
        )}
      </Card>

      {/* --- Review drafts, per source --- */}
      {sources.map((source) => {
        const drafts = source.events.filter((e) => statusOf(e) === "DRAFT");
        // The deterministic ICS path only distrusts ranges; the AI path
        // (#57) also routes same-day siblings and below-confidence-floor
        // rows to individual attention.
        const { confirmAll, individual } = partitionDraftTiers(drafts, {
          // AI-extracted kinds (photo, forwarded email) get the same
          // same-day-sibling distrust; the deterministic ICS path does not.
          siblingsToIndividual:
            source.kind === "IMPORT_PHOTO" || source.kind === "EMAIL_FORWARD",
          needsAttention:
            source.kind === "IMPORT_PHOTO"
              ? (e) =>
                  attentionKeys.has(
                    `${e.startDate}|${normalizeEventTitle(e.title)}`
                  )
              : undefined,
        });
        const confirmed = source.events.filter(
          (e) => statusOf(e) === "CONFIRMED"
        );
        const dismissedCount = source.events.filter(
          (e) => statusOf(e) === "DISMISSED"
        ).length;

        if (source.events.length === 0) return null;

        return (
          <section
            key={source.id}
            aria-label={source.name}
            className="space-y-4"
          >
            <div>
              <h2 className="font-serif text-xl text-text-primary">
                {source.name}
              </h2>
              <p className="text-xs text-text-secondary font-sans">
                {source.kind === "MANUAL"
                  ? "Entered by hand"
                  : source.kind === "EMAIL_FORWARD"
                    ? "From forwarded email"
                    : "Imported calendar"}
                {source.sourceStamp ? ` · ${source.sourceStamp}` : ""}
                {dismissedCount > 0
                  ? ` · ${dismissedCount} dismissed (won't be raised again)`
                  : ""}
              </p>
            </div>

            {drafts.length > 0 && (
              <div className="rounded-lg border border-accent-gold/50 bg-accent-gold/5 p-5 space-y-5">
                {confirmAll.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-serif text-lg text-text-primary">
                          Clear-cut events
                        </h3>
                        <p className="text-xs text-text-secondary font-sans">
                          Single-day entries with explicit dates — confirm
                          them as one batch.
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => confirmIds(confirmAll.map((e) => e.id))}
                      >
                        Confirm all {confirmAll.length}
                      </Button>
                    </div>
                    <ul className="space-y-1">
                      {confirmAll.map((event) => (
                        <li
                          key={event.id}
                          className="text-sm font-sans text-text-secondary"
                        >
                          <span className="text-text-primary">
                            {formatEventDate(event.startDate, event.endDate)}
                          </span>{" "}
                          · {event.title}
                          {event.note ? (
                            <span className="italic"> — {event.note}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {individual.length > 0 && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-serif text-lg text-text-primary">
                        Needs your attention
                      </h3>
                      <p className="text-xs text-text-secondary font-sans">
                        Multi-day ranges — the end date is where
                        transcription mistakes live, so each asks
                        individually.
                      </p>
                    </div>
                    {individual.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-md bg-white border border-bg-secondary p-4 flex items-start justify-between gap-4"
                      >
                        <div>
                          <p className="font-sans text-sm font-medium text-text-primary">
                            {event.title}
                          </p>
                          <p className="text-xs text-text-secondary font-sans">
                            {formatEventDate(event.startDate, event.endDate)}
                            {event.note ? ` · ${event.note}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => confirmIds([event.id])}
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => dismissOne(event.id)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {confirmed.length > 0 && (
              <details className="rounded-lg bg-bg-secondary/50 p-4">
                <summary className="cursor-pointer font-sans text-sm text-text-primary">
                  {confirmed.length} confirmed event
                  {confirmed.length === 1 ? "" : "s"} on the timeline
                </summary>
                <ul className="mt-3 space-y-1">
                  {confirmed.map((event) => (
                    <li
                      key={event.id}
                      className="text-sm font-sans text-text-secondary"
                    >
                      <span className="text-text-primary">
                        {formatEventDate(event.startDate, event.endDate)}
                      </span>{" "}
                      · {event.title}
                      <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs">
                        {event.category}
                      </span>
                      {event.costCents !== null && (
                        <span className="ml-2 text-xs">
                          {formatCurrency(event.costCents / 100)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}

      {/* --- AI extraction (#57): photo or pasted text --- */}
      <ExtractCalendarPanel
        onImported={(lowConfidenceKeys) => {
          setAttentionKeys(lowConfidenceKeys);
          router.refresh();
        }}
      />

      {/* --- Manual entry --- */}
      <Card padding="lg">
        <h2 className="font-serif text-xl text-text-primary mb-1">
          Add an event by hand
        </h2>
        <p className="text-sm text-text-secondary font-sans mb-4 max-w-2xl">
          For the one-offs that never existed on paper. Manual events are
          confirmed immediately — no ratification ceremony for your own
          typing.
        </p>
        <ManualEventForm
          categories={manualSource?.categories ?? ["event"]}
          onCreated={() => router.refresh()}
        />
      </Card>
    </div>
  );
}
