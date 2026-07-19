// Shared draft landing for the ingestion spine (#69/#70): email
// extraction, .ics attachments, and feed-derived renewals all land here.

import { prisma } from "@/lib/prisma";
import { diffAgainstExisting } from "@/lib/timeline/ingestion";
import { normalizeEventTitle } from "@/lib/timeline/natural-key";

/** Land derived/extracted rows as DRAFT Events on a stable source, with
 * the same natural-key dedup as every other import path — a re-derivation
 * raises nothing new and a dismissal stays dismissed. */
export async function landDrafts(
  userId: string,
  source: {
    name: string;
    kind: "IMPORT_ICS" | "EMAIL_FORWARD" | "FEED_DERIVED";
    categories: string[];
  },
  events: {
    startDate: string;
    endDate?: string | null;
    title: string;
    category: string;
    note?: string | null;
    costCents?: number | null;
  }[]
): Promise<{ sourceId: string; created: number; alreadyKnown: number }> {
  let record = await prisma.calendarSource.findFirst({
    where: { userId, kind: source.kind, name: source.name },
    include: { events: { select: { startDate: true, normalizedTitle: true } } },
  });
  if (!record) {
    record = await prisma.calendarSource.create({
      data: {
        userId,
        name: source.name,
        kind: source.kind,
        categories: source.categories,
      },
      include: {
        events: { select: { startDate: true, normalizedTitle: true } },
      },
    });
  } else {
    const fresh = source.categories.filter(
      (c) => !record!.categories.includes(c)
    );
    if (fresh.length > 0) {
      record = await prisma.calendarSource.update({
        where: { id: record.id },
        data: { categories: [...record.categories, ...fresh] },
        include: {
          events: { select: { startDate: true, normalizedTitle: true } },
        },
      });
    }
  }

  const existingKeys = new Set(
    record.events.map(
      (e) => `${e.startDate.toISOString().slice(0, 10)}|${e.normalizedTitle}`
    )
  );
  const diff = diffAgainstExisting(
    events.map((e) => ({
      startDate: e.startDate,
      endDate: e.endDate ?? undefined,
      title: e.title,
      note: e.note ?? undefined,
    })),
    existingKeys
  );

  const byKey = new Map(
    events.map((e) => [
      `${e.startDate}|${normalizeEventTitle(e.title)}`,
      e,
    ])
  );
  if (diff.fresh.length > 0) {
    await prisma.event.createMany({
      data: diff.fresh.map((f) => {
        const original = byKey.get(
          `${f.startDate}|${normalizeEventTitle(f.title)}`
        );
        return {
          calendarSourceId: record!.id,
          startDate: new Date(`${f.startDate}T00:00:00.000Z`),
          endDate: f.endDate ? new Date(`${f.endDate}T00:00:00.000Z`) : null,
          title: f.title,
          normalizedTitle: normalizeEventTitle(f.title),
          category: original?.category ?? record!.categories[0] ?? "event",
          note: f.note ?? null,
          costCents: original?.costCents ?? null,
          status: "DRAFT" as const,
        };
      }),
    });
  }

  return {
    sourceId: record.id,
    created: diff.fresh.length,
    alreadyKnown: diff.existing,
  };
}
