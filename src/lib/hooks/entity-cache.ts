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
  use: () => T;
}

export function createEntityCache<T>(initial: T): EntityCache<T> {
  let value = initial;
  const listeners = new Set<() => void>();

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    get: () => value,
    set: (next) => {
      value =
        typeof next === "function" ? (next as (p: T) => T)(value) : next;
      listeners.forEach((listener) => listener());
    },
    use: () =>
      useSyncExternalStore(
        subscribe,
        () => value,
        () => initial
      ),
  };
}
