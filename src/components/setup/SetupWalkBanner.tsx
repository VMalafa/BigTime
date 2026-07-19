"use client";

// The One Flow's visible layer (#73): a thin stepper over the canonical
// pages — never a parallel copy of them. Derived server-side from what
// the household's data proves; disappears forever the moment
// Safe-to-Spend is computable (income + CSP at 100% + Dials named).

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SetupState } from "@/app/actions/setup";
import {
  getSetupStateCached,
  hasSetupCompleteHint,
  invalidateSetupState,
} from "@/lib/setup/client-cache";

export function SetupWalkBanner() {
  const pathname = usePathname();
  const [state, setState] = useState<SetupState | null>(null);

  useEffect(() => {
    // Established households skip the walk query entirely (UI-state hint).
    if (hasSetupCompleteHint()) return;
    let cancelled = false;
    // Mid-setup, each navigation likely follows a mutation the walk should
    // reflect — refetch. Once complete, the cache answers without a query.
    if (state && !state.complete) invalidateSetupState();
    getSetupStateCached().then((next) => {
      if (cancelled || !next) return;
      setState(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname is
    // the deliberate trigger; `state` here would loop the effect.
  }, [pathname]);

  if (!state || state.complete) return null;

  const currentIndex = state.steps.findIndex((s) => s.key === state.next?.key);

  return (
    <div
      data-setup-walk
      className="mb-6 rounded-xl border border-accent-gold/40 bg-accent-gold/5 px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-xs font-sans uppercase tracking-wide text-text-secondary">
          Setting up
        </p>
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {state.steps.map((step, index) => {
            const isNext = index === currentIndex;
            return (
              <li key={step.key} className="flex items-center gap-1.5">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-sans ${
                    step.done
                      ? "bg-success text-white"
                      : isNext
                        ? "bg-accent-gold text-white"
                        : "bg-bg-secondary text-text-secondary"
                  }`}
                  aria-hidden
                >
                  {step.done ? "✓" : index + 1}
                </span>
                <Link
                  href={step.href}
                  className={`text-sm font-sans ${
                    isNext
                      ? "font-medium text-text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {step.label}
                  {step.optional && !step.done ? (
                    <span className="text-text-secondary"> (skippable)</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
        {state.next && (
          <Link
            href={state.next.href}
            className="ml-auto rounded-full bg-text-primary px-4 py-1.5 text-xs font-sans font-medium text-white hover:bg-text-primary/90 transition-colors"
          >
            Continue setup →
          </Link>
        )}
      </div>
      <p className="mt-1.5 text-xs font-sans text-text-secondary">
        Setup ends the moment Safe-to-Spend is computable — your first real
        number, not a checklist.
      </p>
    </div>
  );
}
