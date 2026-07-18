"use client";

// Subscribe-once household feeds (#90): mint a webcal capability URL per
// feed (whole Household Timeline, or one Calendar Source for a grandparent
// or sitter), show it once as link + QR, revoke or rotate it here. Every
// mutation is an awaited per-intent action (#29); revoke is optimistic
// with rollback.

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  createCalendarFeed,
  listCalendarFeeds,
  revokeCalendarFeed,
  rotateCalendarFeed,
  type CalendarFeedData,
  type FeedScopeOption,
} from "@/app/actions/calendar-feeds";
import { Button } from "@/components/ui/Button";

const HOUSEHOLD_SCOPE = "__household__";

function feedPath(token: string): string {
  return `/api/calendar/feed/${token}.ics`;
}

/** webcal:// — the scheme calendar apps register for one-tap subscribe. */
function webcalUrl(token: string): string {
  return `webcal://${window.location.host}${feedPath(token)}`;
}

function scopeLabel(feed: CalendarFeedData): string {
  return feed.sourceName ?? "Household Timeline";
}

function FeedRow({
  feed,
  onRotate,
  onRevoke,
}: {
  feed: CalendarFeedData;
  onRotate: (id: string) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const url = webcalUrl(feed.token);

  useEffect(() => {
    if (!showQr) return;
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 192 }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [showQr, url]);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-bg-secondary rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-sans text-sm font-medium text-text-primary">
          {scopeLabel(feed)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onRotate(feed.id);
              } finally {
                setBusy(false);
              }
            }}
          >
            Rotate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-error"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onRevoke(feed.id);
              } finally {
                setBusy(false);
              }
            }}
          >
            Revoke
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate text-xs bg-bg-secondary rounded px-2 py-1.5 font-mono text-text-secondary">
          {url}
        </code>
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowQr((v) => !v)}
        >
          QR
        </Button>
      </div>

      {showQr && qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt={`QR code for the ${scopeLabel(feed)} feed`}
          className="w-48 h-48 rounded-lg border border-bg-secondary"
        />
      )}
    </div>
  );
}

export function CalendarFeedsPanel() {
  const [feeds, setFeeds] = useState<CalendarFeedData[]>([]);
  const [sources, setSources] = useState<FeedScopeOption[]>([]);
  const [scope, setScope] = useState<string>(HOUSEHOLD_SCOPE);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCalendarFeeds().then((result) => {
      if ("error" in result) return;
      setFeeds(result.feeds);
      setSources(result.sources);
    });
  }, []);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await createCalendarFeed({
        calendarSourceId: scope === HOUSEHOLD_SCOPE ? null : scope,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setFeeds((prev) => [...prev, result.feed]);
    } finally {
      setCreating(false);
    }
  };

  const rotate = useCallback(async (id: string) => {
    const result = await rotateCalendarFeed({ id });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setFeeds((prev) => prev.map((f) => (f.id === id ? result.feed : f)));
  }, []);

  const revoke = useCallback(async (id: string) => {
    // Optimistic remove with rollback (#29): the row disappears at once;
    // a server refusal puts it back.
    let snapshot: CalendarFeedData[] = [];
    setFeeds((prev) => {
      snapshot = prev;
      return prev.filter((f) => f.id !== id);
    });
    const result = await revokeCalendarFeed({ id });
    if ("error" in result) {
      setFeeds(snapshot);
      setError(result.error);
    }
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-text-secondary text-sm">
        Subscribe once on each phone and the household calendar stays
        current on its own. Apple Calendar refreshes about hourly; Google
        Calendar can take up to a day. Revoking a feed silently stops every
        device subscribed to it.
      </p>

      {feeds.length > 0 && (
        <div className="space-y-3">
          {feeds.map((feed) => (
            <FeedRow
              key={feed.id}
              feed={feed}
              onRotate={rotate}
              onRevoke={revoke}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <select
          aria-label="Feed scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="flex-1 min-w-0 text-sm font-sans border border-bg-secondary rounded-lg px-3 py-2 bg-white text-text-primary"
        >
          <option value={HOUSEHOLD_SCOPE}>
            Whole Household Timeline (life events)
          </option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              Just {source.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="sm" disabled={creating} onClick={create}>
          {creating ? "Creating…" : "Create feed"}
        </Button>
      </div>

      {error && <p className="text-error text-sm font-sans">{error}</p>}
    </div>
  );
}
