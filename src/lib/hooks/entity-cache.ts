"use client";

// The one client-side home for fetched domain data (#53). Not zustand and
// never persisted: each entity keeps a single in-memory snapshot of server
// truth, shared across every hook instance on the page via
// useSyncExternalStore, updated only by hydration reads and the awaited
// per-intent actions' optimistic/confirmed results. A reload starts empty
// and re-reads the server — the database is the only durable home.

import { useSyncExternalStore } from "react";

export interface EntityCache<T> {
  get: () => T;
  set: (next: T | ((previous: T) => T)) => void;
  hydrate: (load: () => Promise<T | null | undefined>) => Promise<void>;
  use: () => T;
}

export function createEntityCache<T>(initial: T): EntityCache<T> {
  let value = initial;
  let version = 0;
  const listeners = new Set<() => void>();

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const set = (next: T | ((previous: T) => T)) => {
    value = typeof next === "function" ? (next as (p: T) => T)(value) : next;
    version += 1;
    listeners.forEach((listener) => listener());
  };

  return {
    get: () => value,
    set,
    // Hydration reads race the awaited mutations: a snapshot fetched before
    // a mutation can resolve after it and would silently roll the mutation
    // back. A stale snapshot can't just be dropped either — it may hold rows
    // the cache has never seen (mutating before first hydration lands). So:
    // apply the snapshot only if nothing wrote while it was in flight, and
    // otherwise fetch again — the retry's snapshot includes the interfering
    // write's server truth, so the loop converges.
    hydrate: async (load) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const seen = version;
        const next = await load();
        if (next == null) return;
        if (version === seen) {
          set(next);
          return;
        }
      }
    },
    use: () =>
      useSyncExternalStore(
        subscribe,
        () => value,
        () => initial
      ),
  };
}

/** Outcome of an awaited per-intent action, normalized for runOptimistic:
 * an app-level refusal ({error}) or the confirmed server value. */
export type OptimisticOutcome<V> = { error: string } | { value: V };

/**
 * The optimistic snapshot→mutate→rollback shape (#109), extracted once:
 * apply the optimistic update, run the awaited action, roll the cache back
 * to the snapshot on failure — an app-level {error} OR a thrown fetch (a
 * dropped request must never leave the optimistic state standing while the
 * server disagrees) — and apply the confirmed update on success.
 */
export async function runOptimistic<T, V>(options: {
  cache: EntityCache<T>;
  optimistic: (state: T) => T;
  action: () => Promise<OptimisticOutcome<V>>;
  confirm?: (state: T, value: V) => T;
  onError: (message: string) => void;
}): Promise<boolean> {
  const snapshot = options.cache.get();
  options.cache.set(options.optimistic);

  let outcome: OptimisticOutcome<V>;
  try {
    outcome = await options.action();
  } catch {
    outcome = { error: "That didn't save — try again." };
  }

  if ("error" in outcome) {
    options.cache.set(snapshot);
    options.onError(outcome.error);
    return false;
  }
  if (options.confirm) {
    const { value } = outcome;
    options.cache.set((state) => options.confirm!(state, value));
  }
  return true;
}
