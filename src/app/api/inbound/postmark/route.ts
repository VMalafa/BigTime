// Postmark inbound webhook (#69): the email mouth of the ingestion spine.
// verify secret → store raw payload (attachments ride inside, base64) in
// Supabase Storage → one InboundEmail record per email → process into
// tiered drafts (or park visibly). Idempotent on Postmark's MessageID, so
// webhook retries never double-draft.
//
// Household resolution: one Postmark inbound address serves one household;
// POSTMARK_INBOUND_USER_EMAIL names it (see
// docs/runbooks/postmark-inbound.md).

import { prisma } from "@/lib/prisma";
import {
  validateInboundPayload,
  verifyInboundSecret,
} from "@/lib/ingestion/inbound";
import { processInboundEmail } from "@/lib/ingestion/process-inbound";
import { storeInboundEmailRaw } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const provided =
    url.searchParams.get("secret") ?? request.headers.get("x-inbound-secret");
  if (!process.env.POSTMARK_INBOUND_SECRET) {
    return Response.json(
      { error: "Inbound email is not configured on this deployment." },
      { status: 503 }
    );
  }
  if (!verifyInboundSecret(provided, process.env.POSTMARK_INBOUND_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const payload = validateInboundPayload(json);
  if (!payload) {
    return Response.json({ error: "Not a Postmark inbound payload" }, {
      status: 400,
    });
  }

  const householdEmail = process.env.POSTMARK_INBOUND_USER_EMAIL;
  const user = householdEmail
    ? await prisma.user.findUnique({
        where: { email: householdEmail },
        select: { id: true },
      })
    : null;
  if (!user) {
    // Configuration problem, not a bad request: 500 keeps Postmark
    // retrying until the runbook step is done.
    return Response.json(
      { error: "POSTMARK_INBOUND_USER_EMAIL is unset or unknown." },
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
  // storage failure is retryable — nothing recorded yet, so Postmark's
  // retry starts clean.
  const storagePath = `${user.id}/${payload.MessageID}.json`;
  const stored = await storeInboundEmailRaw(
    storagePath,
    JSON.stringify(json)
  );
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
