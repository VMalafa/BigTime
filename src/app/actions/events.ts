"use server";

// Household Timeline Event actions (#54) — server-authoritative from birth
// per the ratified #29 architecture: every mutation is an awaited,
// per-intent server action; Events never touch zustand or localStorage.
//
// Status lifecycle (CONTEXT.md, Timeline section): imported Events are
// DRAFT until the household ratifies them (confirmEvents); manual entry may
// create CONFIRMED directly; DISMISSED rows are kept so a re-import never
// re-raises a rejected Event.
//
// Ratification intents revalidate the ingestion/review surface (#55). The
// timeline surface (#56) owns revalidating its own route when it lands.

import { revalidatePath } from "next/cache";
import type { Event } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { normalizeEventTitle } from "@/lib/timeline/natural-key";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a date-only ISO string ("2026-08-12") to UTC midnight, or null. */
function parseDateOnly(value: string): Date | null {
  if (!DATE_ONLY.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Reject silently-rolled-over dates like 2026-02-31.
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

async function getAuthedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export interface CreateEventInput {
  calendarSourceId: string;
  /** Date-only ISO string, e.g. "2026-08-12". */
  startDate: string;
  /** Exclusive end (ICS DTEND convention); omit for single-day. */
  endDate?: string;
  title: string;
  /** One of the owning Calendar Source's categories. */
  category: string;
  note?: string;
  costCents?: number;
  /** Optional person-tagging; household-wide when omitted. */
  profileId?: string;
  /**
   * DRAFT (default) for ingestion paths; CONFIRMED for direct manual entry
   * (#55: no self-ratification ceremony). Never DISMISSED at birth.
   */
  status?: "DRAFT" | "CONFIRMED";
}

export type EventResult =
  | { ok: true; event: Event }
  | { ok?: undefined; error: string };

export async function createEvent(
  input: CreateEventInput
): Promise<EventResult> {
  const userId = await getAuthedUserId();
  if (!userId) return { error: "Not signed in." };

  const source = await prisma.calendarSource.findFirst({
    where: { id: input.calendarSourceId, userId },
    select: { id: true, categories: true },
  });
  if (!source) return { error: "Calendar Source not found." };

  const validated = await validateEventFields(input, source.categories, userId);
  if ("error" in validated) return validated;

  try {
    const event = await prisma.event.create({
      data: {
        calendarSourceId: source.id,
        startDate: validated.startDate,
        endDate: validated.endDate,
        title: input.title.trim(),
        normalizedTitle: validated.normalizedTitle,
        category: input.category,
        note: input.note?.trim() || null,
        costCents: input.costCents ?? null,
        status: input.status ?? "DRAFT",
        profileId: input.profileId ?? null,
      },
    });
    return { ok: true, event };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        error:
          "An event with the same date and title already exists in this Calendar Source.",
      };
    }
    throw err;
  }
}

export interface UpdateEventInput {
  startDate?: string;
  endDate?: string | null;
  title?: string;
  category?: string;
  note?: string | null;
  costCents?: number | null;
  profileId?: string | null;
}

export async function updateEvent(
  eventId: string,
  patch: UpdateEventInput
): Promise<EventResult> {
  const userId = await getAuthedUserId();
  if (!userId) return { error: "Not signed in." };

  const existing = await prisma.event.findFirst({
    where: { id: eventId, calendarSource: { userId } },
    include: { calendarSource: { select: { categories: true } } },
  });
  if (!existing) return { error: "Event not found." };

  const merged: CreateEventInput = {
    calendarSourceId: existing.calendarSourceId,
    startDate:
      patch.startDate ?? existing.startDate.toISOString().slice(0, 10),
    endDate:
      patch.endDate === null
        ? undefined
        : (patch.endDate ?? existing.endDate?.toISOString().slice(0, 10)),
    title: patch.title ?? existing.title,
    category: patch.category ?? existing.category,
    costCents:
      patch.costCents === null ? undefined : (patch.costCents ?? undefined),
    profileId:
      patch.profileId === null
        ? undefined
        : (patch.profileId ?? existing.profileId ?? undefined),
  };

  const validated = await validateEventFields(
    merged,
    existing.calendarSource.categories,
    userId
  );
  if ("error" in validated) return validated;

  try {
    const event = await prisma.event.update({
      where: { id: existing.id },
      data: {
        startDate: validated.startDate,
        endDate: validated.endDate,
        title: merged.title.trim(),
        normalizedTitle: validated.normalizedTitle,
        category: merged.category,
        note:
          patch.note === undefined
            ? existing.note
            : (patch.note?.trim() || null),
        costCents:
          patch.costCents === undefined
            ? existing.costCents
            : patch.costCents,
        profileId:
          patch.profileId === undefined ? existing.profileId : patch.profileId,
      },
    });
    return { ok: true, event };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        error:
          "An event with the same date and title already exists in this Calendar Source.",
      };
    }
    throw err;
  }
}

/**
 * Dismiss a draft: the row is kept (status DISMISSED) so a re-import never
 * re-raises it — the ProposalDecision spirit.
 */
export async function dismissEvent(
  eventId: string
): Promise<{ ok?: boolean; error?: string }> {
  const userId = await getAuthedUserId();
  if (!userId) return { error: "Not signed in." };

  const updated = await prisma.event.updateMany({
    where: { id: eventId, calendarSource: { userId } },
    data: { status: "DISMISSED" },
  });
  if (updated.count === 0) return { error: "Event not found." };
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

/**
 * Ratify drafts in bulk (the confirm-all tier) or singly. Only DRAFT rows
 * move; CONFIRMED is idempotent to re-confirm and DISMISSED stays dismissed
 * unless a human reopens it deliberately (no such intent exists yet).
 */
export async function confirmEvents(
  eventIds: string[]
): Promise<{ ok?: boolean; confirmed?: number; error?: string }> {
  const userId = await getAuthedUserId();
  if (!userId) return { error: "Not signed in." };
  if (eventIds.length === 0) return { error: "No events to confirm." };

  const updated = await prisma.event.updateMany({
    where: {
      id: { in: eventIds },
      calendarSource: { userId },
      status: "DRAFT",
    },
    data: { status: "CONFIRMED" },
  });
  revalidatePath("/dashboard/calendar");
  return { ok: true, confirmed: updated.count };
}

type ValidatedFields =
  | { startDate: Date; endDate: Date | null; normalizedTitle: string }
  | { error: string };

async function validateEventFields(
  input: CreateEventInput,
  sourceCategories: string[],
  userId: string
): Promise<ValidatedFields> {
  const startDate = parseDateOnly(input.startDate);
  if (!startDate) {
    return { error: "Start date must be a valid YYYY-MM-DD date." };
  }

  let endDate: Date | null = null;
  if (input.endDate !== undefined) {
    endDate = parseDateOnly(input.endDate);
    if (!endDate) {
      return { error: "End date must be a valid YYYY-MM-DD date." };
    }
    // Exclusive end: a single-day range is expressed by omitting endDate.
    if (endDate.getTime() <= startDate.getTime()) {
      return { error: "End date must be after the start date." };
    }
  }

  const normalizedTitle = normalizeEventTitle(input.title);
  if (normalizedTitle.length === 0) {
    return { error: "Title is required." };
  }

  if (!sourceCategories.includes(input.category)) {
    return {
      error: "Category must be one of this Calendar Source's categories.",
    };
  }

  if (input.costCents !== undefined) {
    if (!Number.isInteger(input.costCents) || input.costCents < 0) {
      return { error: "Cost must be a non-negative whole number of cents." };
    }
  }

  if (input.status !== undefined && !["DRAFT", "CONFIRMED"].includes(input.status)) {
    return { error: "New events may only be DRAFT or CONFIRMED." };
  }

  if (input.profileId !== undefined) {
    const profile = await prisma.profile.findFirst({
      where: { id: input.profileId, userId },
      select: { id: true },
    });
    if (!profile) return { error: "Profile not found in this household." };
  }

  return { startDate, endDate, normalizedTitle };
}

// Prisma P2002: unique-constraint violation — here, always the Event
// natural key (calendarSourceId, startDate, normalizedTitle).
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
