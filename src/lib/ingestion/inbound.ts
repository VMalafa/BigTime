// The inbound email spine's pure half (#69, per the ingestion-streams
// research): payload validation, webhook-secret comparison, attachment
// selection, sender-stable source naming, and the plain-language park
// notes. The route stays thin; everything here is unit-tested.

import { createHash, timingSafeEqual } from "node:crypto";

export interface InboundAttachment {
  Name: string;
  /** Base64. */
  Content: string;
  ContentType: string;
  ContentLength: number;
}

/** The Postmark inbound webhook JSON, reduced to the fields the spine
 * reads. Everything else rides along in the raw Storage copy. */
export interface InboundPayload {
  MessageID: string;
  From: string;
  FromFull?: { Email?: string; Name?: string };
  Subject: string;
  TextBody?: string;
  HtmlBody?: string;
  Date?: string;
  Attachments?: InboundAttachment[];
}

export function validateInboundPayload(json: unknown): InboundPayload | null {
  if (typeof json !== "object" || json === null) return null;
  const p = json as Record<string, unknown>;
  if (typeof p.MessageID !== "string" || p.MessageID.trim() === "") return null;
  if (typeof p.From !== "string") return null;
  if (typeof p.Subject !== "string") return null;
  return p as unknown as InboundPayload;
}

/** RFC-style "Display Name <box@domain>" → its parts. */
export function parseAddress(value: string): { email: string; name?: string } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
  if (match) {
    const name = match[1].trim();
    return { email: match[2].trim(), name: name || undefined };
  }
  return { email: value.trim() };
}

/**
 * CloudMailin "JSON (Normalized)" → the spine's payload shape (#69's
 * provider swap: Postmark's signup requires a private domain, CloudMailin
 * does not — the route is identical either way, per the research). URL-
 * mode attachments (no embedded content) are carried without content and
 * simply can't ride the deterministic .ics path — the runbook says to
 * configure embedded attachments.
 */
export function validateCloudMailinPayload(
  json: unknown
): InboundPayload | null {
  if (typeof json !== "object" || json === null) return null;
  const p = json as {
    headers?: Record<string, unknown>;
    envelope?: { from?: unknown };
    plain?: unknown;
    html?: unknown;
    attachments?: unknown;
  };
  const headers = p.headers ?? {};
  const fromRaw =
    (typeof headers.from === "string" && headers.from) ||
    (typeof p.envelope?.from === "string" && p.envelope.from) ||
    "";
  if (!fromRaw) return null;
  const subject = typeof headers.subject === "string" ? headers.subject : "";
  const messageId =
    typeof headers.message_id === "string" && headers.message_id.trim() !== ""
      ? headers.message_id.trim()
      : null;
  if (!messageId) return null;

  const from = parseAddress(fromRaw);
  const attachments = Array.isArray(p.attachments)
    ? p.attachments.flatMap((a): InboundAttachment[] => {
        if (typeof a !== "object" || a === null) return [];
        const att = a as Record<string, unknown>;
        return [
          {
            Name: typeof att.file_name === "string" ? att.file_name : "",
            Content: typeof att.content === "string" ? att.content : "",
            ContentType:
              typeof att.content_type === "string" ? att.content_type : "",
            ContentLength: typeof att.size === "number" ? att.size : 0,
          },
        ];
      })
    : [];

  return {
    MessageID: messageId,
    From: from.email,
    FromFull: { Email: from.email, Name: from.name },
    Subject: subject,
    TextBody: typeof p.plain === "string" ? p.plain : undefined,
    HtmlBody: typeof p.html === "string" ? p.html : undefined,
    Date:
      typeof headers.date === "string" ? headers.date : undefined,
    Attachments: attachments,
  };
}

/** Constant-time secret comparison via digest — length never leaks. */
export function verifyInboundSecret(
  provided: string | null,
  expected: string | undefined
): boolean {
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** `.ics` attachments — the deterministic path (#55) rides for free. */
export function pickIcsAttachments(
  payload: InboundPayload
): InboundAttachment[] {
  return (payload.Attachments ?? []).filter(
    (a) =>
      /\.ics$/i.test(a.Name ?? "") ||
      /text\/calendar/i.test(a.ContentType ?? "")
  );
}

export function senderEmail(payload: InboundPayload): string {
  return (payload.FromFull?.Email || payload.From || "").trim().toLowerCase();
}

/**
 * The stable Calendar Source name for a sender: reissues from the same
 * school must land on the SAME source so natural-key dedup can do its
 * work across emails — the InboundEmail row is the per-email record.
 */
export function emailSourceName(payload: InboundPayload): string {
  const name = payload.FromFull?.Name?.trim();
  if (name) return name;
  const email = senderEmail(payload);
  const domain = email.split("@")[1];
  return domain || email || "Forwarded email";
}

/** Best-effort HTML → text for extraction when TextBody is absent. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The body text extraction reads, if any. */
export function extractableText(payload: InboundPayload): string {
  const text = payload.TextBody?.trim();
  if (text) return text;
  const html = payload.HtmlBody?.trim();
  if (html) return htmlToText(html);
  return "";
}

export const PARK_NOTES = {
  nothingToRead: (sender: string) =>
    `Nothing readable arrived from ${sender} — the email is kept, nothing was dropped.`,
  nothingDated: (sender: string) =>
    `No dated events or renewal facts found from ${sender} — the email is kept for your review, nothing was dropped.`,
  extractionUnavailable: (sender: string) =>
    `The email from ${sender} is kept, but extraction isn't configured on this deployment — nothing was dropped.`,
} as const;
