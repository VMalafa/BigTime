import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncAllConnections } from "@/lib/aggregator/sync";
import { refreshHeartbeatSnapshot } from "@/lib/heartbeat/snapshot";

// The daily sync (11:00 UTC, vercel.json). Restored in #109: the original
// route died with the legacy anonymous-sync retirement (#53) while the
// cron kept firing into a 404 — feeds only refreshed when someone pressed
// "sync now" in Settings. After the feed sync, each household's heartbeat
// detection snapshot recomputes here, off the per-view path.
export async function GET(request: Request) {
  // Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the env var
  // is configured; require it in that case so the sync isn't publicly
  // triggerable.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncAllConnections();

  const households = await prisma.aggregatorConnection.findMany({
    where: { status: { not: "REVOKED" } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const snapshots: { userId: string; ok: boolean }[] = [];
  for (const { userId } of households) {
    try {
      await refreshHeartbeatSnapshot(userId);
      snapshots.push({ userId, ok: true });
    } catch (error) {
      console.error("[sync] heartbeat snapshot refresh failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      snapshots.push({ userId, ok: false });
    }
  }

  return NextResponse.json({ ok: true, results, snapshots });
}
