// Inbound email processing (#69): the decision tree behind the Postmark
// route. Order of paths, per the research: (1) `.ics` attachments ride the
// deterministic #55 import; (2) email text runs the #57 calendar
// extraction; (3) then the renewal extraction (the #70-surfaced draft
// type); (4) otherwise the email parks visibly — never silently dropped.
//
// Server-only module: touches prisma, Storage, and the Anthropic API. The
// pure pieces (payload shapes, secret check, source naming, validation)
// live in ./inbound and ./renewal under unit test.

import { parseIcsCalendar } from "@/lib/timeline/ics";
import { landDrafts } from "@/lib/ingestion/land-drafts";
import { getAnthropicClient } from "@/lib/ai/client";
import { anthropicModel } from "@/lib/ai/config";
import {
  buildExtractionSystemPrompt,
  EXTRACTION_TOOL,
  EXTRACTION_TOOL_NAME,
  validateExtraction,
  type ExtractedEvent,
} from "@/lib/timeline/extraction";
import {
  buildRenewalSystemPrompt,
  RENEWAL_TOOL,
  RENEWAL_TOOL_NAME,
  validateRenewalExtraction,
} from "@/lib/ingestion/renewal";
import {
  emailSourceName,
  extractableText,
  PARK_NOTES,
  pickIcsAttachments,
  senderEmail,
  type InboundPayload,
} from "@/lib/ingestion/inbound";

const RENEWALS_SOURCE_NAME = "Renewals";
const MAX_EXTRACT_CHARS = 100_000;

export interface ProcessOutcome {
  status: "PROCESSED" | "PARKED" | "FAILED";
  note: string;
  eventsCreated: number;
  calendarSourceId: string | null;
}

async function runCalendarExtraction(
  text: string,
  yearHint: string
): Promise<{ events: ExtractedEvent[]; categories: string[] } | null> {
  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: anthropicModel(),
    max_tokens: 8192,
    system: buildExtractionSystemPrompt(yearHint),
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `Transcribe every dated event from this forwarded email:\n\n${text}`,
      },
    ],
  });
  const toolUse = message.content.find((b) => b.type === "tool_use");
  const extraction = toolUse ? validateExtraction(toolUse.input) : null;
  if (!extraction || extraction.events.length === 0) return null;
  return { events: extraction.events, categories: extraction.categories };
}

async function runRenewalExtraction(text: string, todayIso: string) {
  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: anthropicModel(),
    max_tokens: 2048,
    system: buildRenewalSystemPrompt(todayIso),
    tools: [RENEWAL_TOOL],
    tool_choice: { type: "tool", name: RENEWAL_TOOL_NAME },
    messages: [{ role: "user", content: text }],
  });
  const toolUse = message.content.find((b) => b.type === "tool_use");
  const extraction = toolUse ? validateRenewalExtraction(toolUse.input) : null;
  if (!extraction || extraction.notices.length === 0) return null;
  return extraction;
}

export async function processInboundEmail(
  userId: string,
  payload: InboundPayload,
  now: Date
): Promise<ProcessOutcome> {
  const sender = senderEmail(payload) || "an unknown sender";

  // --- (1) `.ics` attachments: the deterministic path rides for free.
  const icsAttachments = pickIcsAttachments(payload);
  if (icsAttachments.length > 0) {
    let created = 0;
    let alreadyKnown = 0;
    let sourceId: string | null = null;
    for (const attachment of icsAttachments) {
      const icsText = Buffer.from(attachment.Content, "base64").toString(
        "utf8"
      );
      const parsed = parseIcsCalendar(icsText);
      if (parsed.events.length === 0) continue;
      const sourceName =
        parsed.calendarName ??
        attachment.Name.replace(/\.ics$/i, "").trim() ??
        emailSourceName(payload);
      const landed = await landDrafts(
        userId,
        { name: sourceName, kind: "IMPORT_ICS", categories: ["event"] },
        parsed.events.map((e) => ({
          startDate: e.startDate,
          endDate: e.endDate ?? null,
          title: e.title,
          note: e.note ?? null,
          category: "event",
        }))
      );
      created += landed.created;
      alreadyKnown += landed.alreadyKnown;
      sourceId = landed.sourceId;
    }
    if (sourceId) {
      return {
        status: "PROCESSED",
        note: `${created} draft event${created === 1 ? "" : "s"} from the .ics attachment (${alreadyKnown} already known).`,
        eventsCreated: created,
        calendarSourceId: sourceId,
      };
    }
    // Fall through: attachments existed but held nothing usable.
  }

  const text = extractableText(payload);
  if (!text) {
    return {
      status: "PARKED",
      note: PARK_NOTES.nothingToRead(sender),
      eventsCreated: 0,
      calendarSourceId: null,
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      status: "PARKED",
      note: PARK_NOTES.extractionUnavailable(sender),
      eventsCreated: 0,
      calendarSourceId: null,
    };
  }

  const clipped = text.slice(0, MAX_EXTRACT_CHARS);
  const todayIso = now.toISOString().slice(0, 10);
  const academicYearHint = `${now.getUTCFullYear()}-${String((now.getUTCFullYear() + 1) % 100).padStart(2, "0")}`;

  // --- (2) Calendar facts (Finalsite/Corbett-style school emails).
  const calendar = await runCalendarExtraction(clipped, academicYearHint);
  if (calendar) {
    const landed = await landDrafts(
      userId,
      {
        name: emailSourceName(payload),
        kind: "EMAIL_FORWARD",
        categories:
          calendar.categories.length > 0 ? calendar.categories : ["event"],
      },
      calendar.events.map((e) => ({
        startDate: e.date,
        endDate: e.end ?? null,
        title: e.title,
        note: e.note ?? null,
        category: e.category,
      }))
    );
    return {
      status: "PROCESSED",
      note: `${landed.created} draft event${landed.created === 1 ? "" : "s"} extracted (${landed.alreadyKnown} already known).`,
      eventsCreated: landed.created,
      calendarSourceId: landed.sourceId,
    };
  }

  // --- (3) Renewal notices: the second draft type, surfaced by #70.
  const renewal = await runRenewalExtraction(clipped, todayIso);
  if (renewal) {
    const landed = await landDrafts(
      userId,
      {
        name: RENEWALS_SOURCE_NAME,
        kind: "EMAIL_FORWARD",
        categories: ["renewal"],
      },
      renewal.notices.map((n) => ({
        startDate: n.renewalDate,
        title: `${n.provider} renewal`,
        category: "renewal",
        costCents: n.amountCents ?? null,
        note: [
          n.actionRequired ? "Action required" : "Auto-renews",
          n.note ?? "",
        ]
          .filter(Boolean)
          .join(" — "),
      }))
    );
    return {
      status: "PROCESSED",
      note: `${landed.created} renewal draft${landed.created === 1 ? "" : "s"} recorded (${landed.alreadyKnown} already known).`,
      eventsCreated: landed.created,
      calendarSourceId: landed.sourceId,
    };
  }

  // --- (4) Unknown senders park visibly. Nothing dropped.
  return {
    status: "PARKED",
    note: PARK_NOTES.nothingDated(sender),
    eventsCreated: 0,
    calendarSourceId: null,
  };
}
