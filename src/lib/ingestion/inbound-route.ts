// Shared inbound-webhook handler (#69): provider-agnostic, exactly as the
// ingestion-streams research promised — verify secret → store raw → one
// InboundEmail record → process into tiered drafts (or park visibly).
// Providers differ only in payload shape (a normalizer) and, historically,
// signup policy (the CloudMailin swap: Postmark requires a private-domain
// address to sign up; CloudMailin does not).

import { prisma } from "@/lib/prisma";
import {
  verifyInboundSecret,
  type InboundPayload,
} from "@/lib/ingestion/inbound";
import { processInboundEmail } from "@/lib/ingestion/process-inbound";
import { storeInboundEmailRaw } from "@/lib/supabase/admin";

function inboundSecret(): string | undefined {
  return (
    process.env.INBOUND_EMAIL_SECRET || process.env.POSTMARK_INBOUND_SECRET
  );
}

function householdEmail(): string | undefined {
  return (
    process.env.INBOUND_EMAIL_USER_EMAIL ||
    process.env.POSTMARK_INBOUND_USER_EMAIL
  );
}

export async function handleInboundRequest(
  request: Request,
  normalize: (json: unknown) => InboundPayload | null
): Promise<Response> {
  const url = new URL(request.url);
  const provided =
    url.searchParams.get("secret") ?? request.headers.get("x-inbound-secret");
  if (!inboundSecret()) {
    return Response.json(
      { error: "Inbound email is not configured on this deployment." },
      { status: 503 }
    );
  }
  if (!verifyInboundSecret(provided, inboundSecret())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const payload = normalize(json);
  if (!payload) {
    return Response.json(
      { error: "Not a recognized inbound payload" },
      { status: 400 }
    );
  }

  const email = householdEmail();
  const user = email
    ? await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
    : null;
  if (!user) {
    // Configuration problem, not a bad request: 500 keeps the provider
    // retrying until the runbook step is done.
    return Response.json(
      { error: "INBOUND_EMAIL_USER_EMAIL is unset or unknown." },
      { status: 500 }
    );
  }

  // Idempotency: a retried MessageID acknowledges without reprocessing.
  const existing = await prisma.inboundEmail.findUnique({
    where: { messageId: payload.MessageID },
    select: { id: true, status: true },
  });
  if (existing) {
    return Response.json({ ok: true, status: existing.status, retried: true });
  }

  // Raw first (acceptance: raw email + attachments land in Storage). A
  // storage failure is retryable — nothing recorded yet, so the provider's
  // retry starts clean.
  // Storage keys reject most punctuation (RFC 5322 message-ids arrive as
  // "<id@host>") — sanitize for the path; idempotency lives on the DB's
  // unique messageId, not this key.
  const safeId = payload.MessageID.replace(/[^A-Za-z0-9._-]/g, "_");
  const storagePath = `${user.id}/${safeId}.json`;
  const stored = await storeInboundEmailRaw(storagePath, JSON.stringify(json));
  if ("error" in stored) {
    return Response.json(
      { error: `Storage failed: ${stored.error}` },
      { status: 500 }
    );
  }

  const now = new Date();
  let outcome;
  try {
    outcome = await processInboundEmail(user.id, payload, now);
  } catch (err) {
    // The raw copy is safe in Storage; record the failure honestly and
    // acknowledge — an extraction hiccup must not retry-loop the webhook.
    // Log the error only (never email content) — verify-production scans
    // runtime logs, so this is the deployment's failure signal.
    console.error(
      `[inbound-email] processing failed for ${payload.MessageID}:`,
      err instanceof Error ? err.message : err
    );
    outcome = {
      status: "FAILED" as const,
      note: "Processing failed after the email was stored — the raw copy is safe and nothing was dropped.",
      eventsCreated: 0,
      calendarSourceId: null,
    };
  }

  await prisma.inboundEmail.create({
    data: {
      userId: user.id,
      messageId: payload.MessageID,
      fromAddress: payload.FromFull?.Email ?? payload.From,
      subject: payload.Subject,
      receivedAt: payload.Date ? new Date(payload.Date) : now,
      storagePath,
      status: outcome.status,
      note: outcome.note,
      eventsCreated: outcome.eventsCreated,
      calendarSourceId: outcome.calendarSourceId,
    },
  });

  return Response.json({
    ok: true,
    status: outcome.status,
    eventsCreated: outcome.eventsCreated,
  });
}
