import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { syncAllConnections } from "@/lib/aggregator/sync";

// Daily sync endpoint, hit by the Vercel cron (see vercel.json). Guarded by
// CRON_SECRET — Vercel sends it automatically as `Authorization: Bearer …`
// when the env var is set.

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return Response.json(
      { error: "Sync is not configured (CRON_SECRET is unset)." },
      { status: 503 }
    );
  }
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncAllConnections();
  return Response.json({
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
