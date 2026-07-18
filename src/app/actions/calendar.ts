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
