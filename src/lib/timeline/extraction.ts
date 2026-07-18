// AI calendar extraction (#57): prompt, structured-output tool schema, and
// pure validation for turning a school-calendar photo or pasted text into
// draft Events. The model output is never calendar truth — everything
// lands as DRAFT through the same tiered ratification surface as ICS
// imports (the feed drafts, the human ratifies).
//
// The failure modes catalogued in docs/research/calendar-ingestion.md
// (adjacent-days-vs-range, year inference, inclusive→exclusive ends,
// notes-vs-titles, same-day siblings) shape both the prompt and the
// review tiering in ingestion.ts.

export const EXTRACTION_TOOL_NAME = "record_calendar_events";

/** Structured-output tool: the model must answer through this schema. */
export const EXTRACTION_TOOL = {
  name: EXTRACTION_TOOL_NAME,
  description:
    "Record every dated event found in the school calendar artifact.",
  input_schema: {
    type: "object" as const,
    properties: {
      calendarName: {
        type: "string",
        description:
          'The calendar\'s own name, e.g. "Corbett Prep 2026-27". Empty string if the artifact names none.',
      },
      categories: {
        type: "array",
        items: { type: "string" },
        description:
          "The artifact's own category vocabulary, lowercase, in the artifact's terms (e.g. holiday, dismissal, break, event, academic). Never invent a universal taxonomy.",
      },
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "Start date, ISO YYYY-MM-DD.",
            },
            end: {
              type: "string",
              description:
                "EXCLUSIVE end date (day after the last day), ISO YYYY-MM-DD. Omit for single-day events.",
            },
            title: { type: "string" },
            category: {
              type: "string",
              description: "One of the categories above.",
            },
            note: {
              type: "string",
              description:
                "Italic riders and qualifiers (e.g. 'Extended Day Available') — never concatenated into the title.",
            },
            confidence: {
              type: "number",
              description:
                "0-1. Below 1 when the source was ambiguous: '&'-style date lists, inferred years, handwriting.",
            },
          },
          required: ["date", "title", "category", "confidence"],
        },
      },
    },
    required: ["calendarName", "categories", "events"],
  },
};

export function buildExtractionSystemPrompt(academicYearHint: string): string {
  return [
    "You transcribe school calendars into structured events. Rules:",
    `- The calendar covers the ${academicYearHint} academic year. Dates written without a year belong to whichever year of that span makes chronological sense; lower your confidence when the year is inferred rather than explicit.`,
    "- Multi-day ranges use an EXCLUSIVE end (the day after the last day). Humans write inclusive ranges — convert.",
    "- A date list like 'Thurs. 13 & Fri. 14' may be separate events or one range; encode what the source most likely means and lower the confidence.",
    "- Two different events on the same date stay two events — never merge same-day siblings.",
    "- Qualifiers like 'Extended Day Available' go in note, never in the title.",
    "- Use the artifact's own category words, lowercased. Do not invent categories the artifact doesn't use.",
    "- Transcribe every dated entry; skip nothing silently.",
  ].join("\n");
}

export interface ExtractedEvent {
  date: string;
  end?: string;
  title: string;
  category: string;
  note?: string;
  confidence: number;
}

export interface ExtractionResult {
  calendarName: string | null;
  categories: string[];
  events: ExtractedEvent[];
  /** Rows the model produced that failed validation — reported, not
   * silently dropped (Honesty Rule). */
  rejected: number;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/** Validate the model's tool input into a clean extraction result. Pure —
 * unit-tested against the Corbett ground truth. */
export function validateExtraction(raw: unknown): ExtractionResult | null {
  if (typeof raw !== "object" || raw === null) return null;
  const input = raw as {
    calendarName?: unknown;
    categories?: unknown;
    events?: unknown;
  };
  if (!Array.isArray(input.events)) return null;

  const categories = Array.isArray(input.categories)
    ? [
        ...new Set(
          input.categories
            .filter((c): c is string => typeof c === "string")
            .map((c) => c.trim().toLowerCase())
            .filter((c) => c.length > 0)
        ),
      ]
    : [];
  if (categories.length === 0) categories.push("event");

  const events: ExtractedEvent[] = [];
  let rejected = 0;
  for (const item of input.events) {
    if (typeof item !== "object" || item === null) {
      rejected++;
      continue;
    }
    const e = item as Record<string, unknown>;
    const date = typeof e.date === "string" ? e.date : "";
    const end = typeof e.end === "string" ? e.end : undefined;
    const title = typeof e.title === "string" ? e.title.trim() : "";
    const rawCategory =
      typeof e.category === "string" ? e.category.trim().toLowerCase() : "";
    const note = typeof e.note === "string" ? e.note.trim() : undefined;
    const confidence =
      typeof e.confidence === "number" &&
      e.confidence >= 0 &&
      e.confidence <= 1
        ? e.confidence
        : 0.5;

    if (!isValidDate(date) || title.length === 0) {
      rejected++;
      continue;
    }
    if (end !== undefined && (!isValidDate(end) || end <= date)) {
      rejected++;
      continue;
    }

    events.push({
      date,
      end,
      title,
      // A category outside the artifact's vocabulary falls back to the
      // first vocabulary word; chips are editable at review anyway.
      category: categories.includes(rawCategory) ? rawCategory : categories[0],
      note: note || undefined,
      confidence,
    });
  }

  return {
    calendarName:
      typeof input.calendarName === "string" && input.calendarName.trim()
        ? input.calendarName.trim()
        : null,
    categories,
    events,
    rejected,
  };
}

/** Below this, an extracted event never joins the confirm-all bundle
 * (precedent: proposals' CONFIRM_ALL_MIN_CONFIDENCE). */
export const CONFIRM_ALL_MIN_CONFIDENCE = 0.75;
