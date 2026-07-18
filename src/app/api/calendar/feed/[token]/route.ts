// The subscribable household feed (#90): GET /api/calendar/feed/<token>.ics
//
// The token is the whole auth — subscription clients (Apple, Google,
// Outlook) send no credentials, so possession of the capability URL is the
// consent, revocable by deleting the token row (ADR-0001 posture,
// outbound). Kept deliberately thin: parsing, scoping, and ICS bytes live
// in src/lib/timeline/feed.ts under unit test; this file is the wiring.
//
// Anti-enumeration: requests are rate-limited before anything else; a
// malformed token 404s before the database is touched; a well-formed miss
// is a single unique-index probe returning the same 404 — no timing or
// body signal distinguishes "bad shape" from "revoked" from "never
// existed".

import { prisma } from "@/lib/prisma";
import { buildFeedIcs, parseFeedPath } from "@/lib/timeline/feed";
import { createRateLimiter } from "@/lib/timeline/feed-rate-limit";

// Apple's default refresh is hourly per device; 60/min per IP is far above
// any real household's polling and far below an enumeration attempt.
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (!limiter.check(ip, Date.now())) {
    return new Response("Too many requests", { status: 429 });
  }

  const { token: segment } = await params;
  const token = parseFeedPath(decodeURIComponent(segment));
  if (!token) return notFound();

  const feed = await prisma.calendarFeedToken.findUnique({
    where: { token },
    include: { calendarSource: { select: { name: true } } },
  });
  if (!feed) return notFound();

  // CONFIRMED Events only — drafts and dismissals never leave the app.
  // Money moments are derived live from the engines and are never stored
  // as Events, so a feed structurally cannot carry them.
  const events = await prisma.event.findMany({
    where: {
      status: "CONFIRMED",
      calendarSource: feed.calendarSourceId
        ? { id: feed.calendarSourceId }
        : { userId: feed.userId },
    },
    orderBy: [{ startDate: "asc" }, { normalizedTitle: "asc" }],
    select: { startDate: true, endDate: true, title: true, note: true },
  });

  // Full regeneration per fetch — subscription clients poll, and the fresh
  // body is exactly how an Event edit propagates on their next refresh.
  const ics = buildFeedIcs({
    scopeName: feed.calendarSource?.name ?? null,
    events,
    now: new Date(),
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
