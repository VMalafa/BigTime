// Basic rate limit for the feed route (#90): a fixed window per client
// key, in process memory. On serverless this is per-instance and resets on
// cold start — that's the "modest" limit the research calls for: it blunts
// token-enumeration bursts without pretending to be infrastructure. The
// clock is injected so seam-1 tests drive it deterministically.

export interface RateLimiter {
  /** true = allowed; false = over the limit for this window. */
  check(key: string, now: number): boolean;
}

export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  return {
    check(key, now) {
      const window = windows.get(key);
      if (!window || now - window.start >= options.windowMs) {
        // Opportunistic sweep so the map can't grow unbounded across a
        // long-lived instance.
        if (windows.size > 10_000) {
          for (const [k, w] of windows) {
            if (now - w.start >= options.windowMs) windows.delete(k);
          }
        }
        windows.set(key, { start: now, count: 1 });
        return true;
      }
      window.count++;
      return window.count <= options.limit;
    },
  };
}
