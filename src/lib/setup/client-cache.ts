"use client";

// One setup-state read per page load (#73): the walk banner and Home both
// need it, and the pooled single connection shouldn't pay twice. UI-state
// caching only — the value itself is always server-derived.

import { getSetupState, type SetupState } from "@/app/actions/setup";

// UI-state hint only (never domain data, #29): once THIS BROWSER has seen
// setup complete, the walk banner stops querying on every page load. Same
// precedent as the draft-cleared marker in AppHeader. Worst case a stale
// hint hides guidance on a shared machine — the walk is guidance, never
// truth; Home still reads real server state for its own affordances.
const COMPLETE_HINT_KEY = "rich-life-setup-complete";

export function hasSetupCompleteHint(): boolean {
  try {
    return localStorage.getItem(COMPLETE_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

let inflight: Promise<SetupState | null> | null = null;
let settled: SetupState | null = null;

export function getSetupStateCached(): Promise<SetupState | null> {
  if (settled?.complete) return Promise.resolve(settled);
  if (!inflight) {
    inflight = getSetupState()
      .then((state) => {
        settled = state;
        if (state?.complete) {
          try {
            localStorage.setItem(COMPLETE_HINT_KEY, "1");
          } catch {
            // Storage unavailable: the hint is an optimization only.
          }
        }
        return state;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Force the next read to hit the server (e.g. after a dismissal). */
export function invalidateSetupState(): void {
  inflight = null;
  settled = null;
}
