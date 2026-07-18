"use server";

// Calendar ingestion v1 (#55): the deterministic paths. ICS-subset import
// lands DRAFT Events on a Calendar Source (the feed drafts, the human
// ratifies); manual entry creates a CONFIRMED Event directly — no
// self-ratification ceremony. Both are awaited per-intent actions per the
// ratified #29 architecture.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { parseIcsCalendar } from "@/lib/timeline/ics";
import { diffAgainstExisting } from "@/lib/timeline/ingestion";
import { normalizeEventTitle } from "@/lib/timeline/natural-key";
import { createEvent, type CreateEventInput } from "@/app/actions/events";
import { getAnthropicClient } from "@/lib/ai/client";
import { anthropicModel } from "@/lib/ai/config";
import {
  buildExtractionSystemPrompt,
  EXTRACTION_TOOL,
  EXTRACTION_TOOL_NAME,
  validateExtraction,
  type ExtractedEvent,
  type ExtractionResult,
} from "@/lib/timeline/extraction";

const CALENDAR_PATH = "/dashboard/calendar";
const MAX_ICS_BYTES = 1_000_000;
const MANUAL_SOURCE_NAME = "Manual entries";

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export interface ImportIcsResult {
  ok: true;
  sourceId: string;
  sourceName: string;
  /** DRAFT Events created by this import. */
  created: number;
  /** Natural keys already on the source — confirmed stay confirmed,
   * dismissed stay dismissed, drafts aren't duplicated. */
  alreadyKnown: number;
  duplicatesInFile: number;
  /** VEVENTs outside the date-only subset (e.g. timed). */
  skipped: number;
}

export async function importIcsCalendar(input: {
  fileName: string;
  icsText: string;
}): Promise<ImportIcsResult | { error: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: "Not signed in." };

  if (input.icsText.length > MAX_ICS_BYTES) {
    return { error: "That file is too large for a calendar import." };
  }

  const parsed = parseIcsCalendar(input.icsText);
  if (parsed.events.length === 0) {
    return {
      error:
        parsed.skipped > 0
          ? "No date-only events found — this import handles all-day school-calendar events."
          : "No events found in that file.",
    };
  }

  // The source name comes from the calendar itself (X-WR-CALNAME) so a
  // reissued file naturally lands on the same Calendar Source and the
  // natural-key dedup does its work.
  const sourceName =
    parsed.calendarName ??
    (input.fileName.replace(/\.ics$/i, "").trim() || "Imported calendar");

  let source = await prisma.calendarSource.findFirst({
    where: { userId, kind: "IMPORT_ICS", name: sourceName },
    include: { events: { select: { startDate: true, normalizedTitle: true } } },
  });
  if (!source) {
    source = await prisma.calendarSource.create({
      data: {
        userId,
        name: sourceName,
        kind: "IMPORT_ICS",
        // ICS carries no category field, so an imported source starts with
        // a one-word vocabulary; per-source chips stay editable at review.
        categories: ["event"],
      },
      include: {
        events: { select: { startDate: true, normalizedTitle: true } },
      },
    });
  }

  const existingKeys = new Set(
    source.events.map(
      (e) => `${e.startDate.toISOString().slice(0, 10)}|${e.normalizedTitle}`
    )
  );
  const diff = diffAgainstExisting(parsed.events, existingKeys);

  const defaultCategory = source.categories[0] ?? "event";
  if (diff.fresh.length > 0) {
    await prisma.event.createMany({
      data: diff.fresh.map((e) => ({
        calendarSourceId: source.id,
        startDate: new Date(`${e.startDate}T00:00:00.000Z`),
        endDate: e.endDate ? new Date(`${e.endDate}T00:00:00.000Z`) : null,
        title: e.title,
        normalizedTitle: normalizeEventTitle(e.title),
        category: defaultCategory,
        note: e.note ?? null,
        status: "DRAFT",
      })),
      // Same-run safety net; the diff already collapsed in-file duplicates.
      skipDuplicates: true,
    });
  }

  revalidatePath(CALENDAR_PATH);
  return {
    ok: true,
    sourceId: source.id,
    sourceName,
    created: diff.fresh.length,
    alreadyKnown: diff.existing,
    duplicatesInFile: diff.duplicatesInFile,
    skipped: parsed.skipped,
  };
}

export type ManualEventInput = Omit<CreateEventInput, "calendarSourceId" | "status">;

/**
 * Manual entry (#55): always present, never the main path. Creates a
 * CONFIRMED Event directly on the household's MANUAL Calendar Source,
 * creating that source on first use. A new category grows the source's own
 * vocabulary — the app never forces a universal Event taxonomy.
 */
export async function createManualEvent(input: ManualEventInput) {
  const userId = await requireUserId();
  if (!userId) return { error: "Not signed in." } as const;

  const category = input.category.trim();
  if (!category) return { error: "Category is required." } as const;

  let source = await prisma.calendarSource.findFirst({
    where: { userId, kind: "MANUAL" },
    select: { id: true, categories: true },
  });
  if (!source) {
    source = await prisma.calendarSource.create({
      data: {
        userId,
        name: MANUAL_SOURCE_NAME,
        kind: "MANUAL",
        categories: [category],
      },
      select: { id: true, categories: true },
    });
  } else if (!source.categories.includes(category)) {
    source = await prisma.calendarSource.update({
      where: { id: source.id },
      data: { categories: [...source.categories, category] },
      select: { id: true, categories: true },
    });
  }

  const result = await createEvent({
    ...input,
    category,
    calendarSourceId: source.id,
    status: "CONFIRMED",
  });
  if (result.ok) revalidatePath(CALENDAR_PATH);
  return result;
}

// ---------------------------------------------------------------------------
// AI extraction (#57): the real-world path — a photo or pasted text of a
// school calendar, extracted by Claude through a structured-output tool
// schema, landing as DRAFT Events in the same tiered ratification surface.
// Runs in-app on ANTHROPIC_API_KEY (bursty, user-initiated, cents per
// school year — NOT the ADR-0003 Max batch). The upload lives only in this
// request's memory: it is sent to the extraction API and never written to
// disk or database (no retention, no scope creep beyond calendar imports).

const MAX_TEXT_CHARS = 100_000;
const MAX_IMAGE_BASE64_CHARS = 8_000_000; // ~6 MB decoded

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

const IMAGE_MEDIA_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXTRACTION_FAILED_MESSAGE =
  "We couldn't read that calendar — try a clearer photo or paste the text, or add events by hand below.";

export async function extractCalendarEvents(input: {
  text?: string;
  image?: { mediaType: string; dataBase64: string };
  /** e.g. "2026-27" — carried in the prompt for year inference. */
  academicYearHint: string;
}): Promise<{ ok: true; extraction: ExtractionResult } | { error: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: "Not signed in." };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: EXTRACTION_FAILED_MESSAGE };
  }
  const text = input.text?.trim();
  if (!text && !input.image) {
    return { error: "Paste the calendar text or choose a photo first." };
  }
  if (text && text.length > MAX_TEXT_CHARS) {
    return { error: "That text is too long for a calendar import." };
  }
  if (input.image) {
    if (!IMAGE_MEDIA_TYPES.has(input.image.mediaType)) {
      return { error: "Use a JPEG, PNG, WebP, or GIF photo." };
    }
    if (input.image.dataBase64.length > MAX_IMAGE_BASE64_CHARS) {
      return { error: "That photo is too large — try a smaller one." };
    }
  }

  const yearHint = input.academicYearHint.trim() || "current";

  try {
    const anthropic = getAnthropicClient();
    const content: Array<
      | { type: "text"; text: string }
      | {
          type: "image";
          source: { type: "base64"; media_type: ImageMediaType; data: string };
        }
    > = [];
    if (input.image) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: input.image.mediaType as ImageMediaType,
          data: input.image.dataBase64,
        },
      });
    }
    content.push({
      type: "text",
      text: text
        ? `Transcribe every dated event from this calendar text:\n\n${text}`
        : "Transcribe every dated event from this calendar photo.",
    });

    const message = await anthropic.messages.create({
      model: anthropicModel(),
      max_tokens: 8192,
      system: buildExtractionSystemPrompt(yearHint),
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
      messages: [{ role: "user", content }],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    const extraction = toolUse ? validateExtraction(toolUse.input) : null;
    if (!extraction || extraction.events.length === 0) {
      return { error: EXTRACTION_FAILED_MESSAGE };
    }
    return { ok: true, extraction };
  } catch {
    // Degrade gracefully to manual entry — never a stack trace at the user.
    return { error: EXTRACTION_FAILED_MESSAGE };
  }
}

/** Land validated extraction output as DRAFT Events on an IMPORT_PHOTO
 * Calendar Source, with the same natural-key dedup as ICS re-imports. */
export async function importExtractedEvents(input: {
  sourceName: string;
  categories: string[];
  events: ExtractedEvent[];
}): Promise<ImportIcsResult | { error: string }> {
  const userId = await requireUserId();
  if (!userId) return { error: "Not signed in." };
  if (input.events.length === 0) return { error: "Nothing to import." };

  const sourceName = input.sourceName.trim() || "Imported photo calendar";
  const vocabulary = [
    ...new Set(
      input.categories
        .map((c) => c.trim().toLowerCase())
        .filter((c) => c.length > 0)
    ),
  ];
  if (vocabulary.length === 0) vocabulary.push("event");

  let source = await prisma.calendarSource.findFirst({
    where: { userId, kind: "IMPORT_PHOTO", name: sourceName },
    include: { events: { select: { startDate: true, normalizedTitle: true } } },
  });
  if (!source) {
    source = await prisma.calendarSource.create({
      data: {
        userId,
        name: sourceName,
        kind: "IMPORT_PHOTO",
        categories: vocabulary,
      },
      include: {
        events: { select: { startDate: true, normalizedTitle: true } },
      },
    });
  } else {
    // A reissued artifact may grow the vocabulary; the source owns it.
    const grown = [...new Set([...source.categories, ...vocabulary])];
    if (grown.length !== source.categories.length) {
      await prisma.calendarSource.update({
        where: { id: source.id },
        data: { categories: grown },
      });
      source = { ...source, categories: grown };
    }
  }

  const existingKeys = new Set(
    source.events.map(
      (e) => `${e.startDate.toISOString().slice(0, 10)}|${e.normalizedTitle}`
    )
  );
  const diff = diffAgainstExisting(
    input.events.map((e) => ({
      startDate: e.date,
      endDate: e.end,
      title: e.title,
      note: e.note,
    })),
    existingKeys
  );

  if (diff.fresh.length > 0) {
    const byKey = new Map(
      input.events.map((e) => [
        `${e.date}|${normalizeEventTitle(e.title)}`,
        e,
      ])
    );
    await prisma.event.createMany({
      data: diff.fresh.map((e) => {
        const original = byKey.get(
          `${e.startDate}|${normalizeEventTitle(e.title)}`
        );
        const category = original?.category ?? source.categories[0];
        return {
          calendarSourceId: source.id,
          startDate: new Date(`${e.startDate}T00:00:00.000Z`),
          endDate: e.endDate ? new Date(`${e.endDate}T00:00:00.000Z`) : null,
          title: e.title,
          normalizedTitle: normalizeEventTitle(e.title),
          category: source.categories.includes(category)
            ? category
            : source.categories[0],
          note: e.note ?? null,
          status: "DRAFT" as const,
        };
      }),
      skipDuplicates: true,
    });
  }

  revalidatePath(CALENDAR_PATH);
  return {
    ok: true,
    sourceId: source.id,
    sourceName,
    created: diff.fresh.length,
    alreadyKnown: diff.existing,
    duplicatesInFile: diff.duplicatesInFile,
    skipped: 0,
  };
}
