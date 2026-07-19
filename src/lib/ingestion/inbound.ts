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
