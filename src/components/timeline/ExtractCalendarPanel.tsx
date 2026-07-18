"use client";

// AI extraction panel (#57): upload a photo or paste the text of a school
// calendar; Claude extracts draft Events through a structured-output
// schema and they land in the same tiered review above. Extraction output
// is never calendar truth until confirmed. On failure the panel degrades
// gracefully — manual entry sits right below.

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  extractCalendarEvents,
  importExtractedEvents,
} from "@/app/actions/calendar";
import { CONFIRM_ALL_MIN_CONFIDENCE } from "@/lib/timeline/extraction";
import { normalizeEventTitle } from "@/lib/timeline/natural-key";

function defaultAcademicYearHint(): string {
  const now = new Date();
  // School years straddle the calendar year; from July onward the span
  // starts this year, before July it started last year.
  const startYear =
    now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function ExtractCalendarPanel({
  onImported,
}: {
  onImported: (lowConfidenceKeys: Set<string>) => void;
}) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [yearHint, setYearHint] = useState(defaultAcademicYearHint());
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    setBusy(true);
    setError(null);
    setSummary(null);

    const image = photo
      ? {
          mediaType: photo.type,
          dataBase64: await fileToBase64(photo),
        }
      : undefined;

    const extracted = await extractCalendarEvents({
      text: text.trim() || undefined,
      image,
      academicYearHint: yearHint,
    });
    if ("error" in extracted) {
      setBusy(false);
      setError(extracted.error);
      return;
    }

    const { extraction } = extracted;
    const imported = await importExtractedEvents({
      sourceName: extraction.calendarName ?? "Imported photo calendar",
      categories: extraction.categories,
      events: extraction.events,
    });
    setBusy(false);
    if ("error" in imported) {
      setError(imported.error);
      return;
    }

    const parts = [
      `${imported.created} new draft${imported.created === 1 ? "" : "s"}`,
      `${imported.alreadyKnown} already known`,
    ];
    if (extraction.rejected > 0) {
      parts.push(`${extraction.rejected} unreadable row${extraction.rejected === 1 ? "" : "s"} skipped`);
    }
    setSummary(`${imported.sourceName}: ${parts.join(", ")}. Review below.`);
    setText("");
    setPhoto(null);

    // Rows the model was unsure about join the individual-attention tier
    // for this review session.
    onImported(
      new Set(
        extraction.events
          .filter((e) => e.confidence < CONFIRM_ALL_MIN_CONFIDENCE)
          .map((e) => `${e.date}|${normalizeEventTitle(e.title)}`)
      )
    );
  }

  return (
    <Card padding="lg">
      <h2 className="font-serif text-xl text-text-primary mb-1">
        Extract from a photo or pasted text
      </h2>
      <p className="text-sm text-text-secondary font-sans mb-4 max-w-2xl">
        The real-world path: snap the school calendar (or paste the email)
        and review what lands — everything arrives as drafts, nothing is
        truth until you confirm it. The photo is read once and never stored.
      </p>

      <div className="space-y-4 max-w-2xl">
        <textarea
          className="w-full bg-bg-secondary rounded-lg p-3 font-sans text-sm text-text-primary placeholder:text-text-secondary/60 min-h-[90px] resize-y border-0 outline-none focus:ring-2 focus:ring-accent-gold"
          placeholder="Paste the calendar text or email here…"
          aria-label="Calendar text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="calendar-photo"
              className="font-sans text-sm font-medium text-text-primary"
            >
              Or a photo
            </label>
            <input
              id="calendar-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={busy}
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-text-secondary font-sans file:mr-3 file:rounded-lg file:border-0 file:bg-bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text-primary file:cursor-pointer"
            />
          </div>
          <Input
            label="School year"
            value={yearHint}
            onChange={(e) => setYearHint(e.target.value)}
            helperText="Used to infer years the calendar leaves off"
          />
        </div>

        <Button
          type="button"
          variant="primary"
          disabled={busy || (!text.trim() && !photo)}
          onClick={() => void handleExtract()}
        >
          {busy ? "Reading the calendar…" : "Extract & review"}
        </Button>

        {summary && (
          <p role="status" className="text-sm text-text-primary font-sans">
            {summary}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 font-sans">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
