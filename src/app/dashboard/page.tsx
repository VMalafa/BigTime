"use client";

// The one-truth Home (#77, Variant A from the #27 prototype): the
// household's state IS the screen. One word, one sentence, at most one
// action; Safe-to-Spend below; the honest uncategorized chip; a door into
// "where did it go". Deliberately absent: debt totals, income cards,
// charts, bonuses (#25/#27). Server data only (#53) — nothing here reads
// the UI-state store.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/hooks/useAuth";
import { getHomeTruth, type HomeTruth } from "@/app/actions/home";
import { dismissSideQuest, type SetupState } from "@/app/actions/setup";
import {
  getSetupStateCached,
  invalidateSetupState,
} from "@/lib/setup/client-cache";
import { SafeToSpendCard } from "@/components/dashboard/SafeToSpendCard";
import { TodayStrip } from "@/components/dashboard/TodayStrip";
import type { WeatherState } from "@/lib/heartbeat/weather";

const WEATHER_STYLE: Record<WeatherState, { dot: string; text: string }> = {
  Steady: { dot: "bg-success", text: "text-success" },
  Watch: { dot: "bg-warning", text: "text-warning" },
  Attention: { dot: "bg-error", text: "text-error" },
};

export default function DashboardPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [truth, setTruth] = useState<HomeTruth | null>(null);
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [questHidden, setQuestHidden] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      getHomeTruth().then((data) => setTruth(data));
      // Shared per-page-load cache: the walk banner's read answers this too.
      getSetupStateCached().then((data) => setSetup(data));
    }
  }, [isAuthenticated, authLoading]);

  // Dismiss-forever (#73): optimistic hide, rollback if the server says no.
  async function handleDismissQuest() {
    setQuestHidden(true);
    const result = await dismissSideQuest();
    if (result.error) {
      setQuestHidden(false);
    } else {
      invalidateSetupState();
    }
  }

  const showSideQuest =
    setup?.complete === true && !setup.sideQuestDismissed && !questHidden;
  const showLinkNudge = setup !== null && !setup.hasLinkedAccount;

  const weather = truth?.weather ?? null;
  const style = weather ? WEATHER_STYLE[weather.state] : null;
  const uncategorized = truth?.uncategorizedCount ?? 0;

  return (
    <div className="mx-auto max-w-md flex flex-col min-h-[70vh]">
      {/* Settings lost its nav slot (#60) and launches from Home. */}
      <div className="flex justify-end">
        <Link
          href="/dashboard/settings"
          aria-label="Settings"
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      {/* The Household Weather hero: state word + one plain sentence +
          exactly one action when non-Steady. Sized so word and action fit
          one phone screen without scrolling — the hotel-lobby glance. */}
      {weather && style && (
        <motion.section
          data-weather-state={weather.state}
          className="flex-1 flex flex-col justify-center text-center py-10"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className={`mx-auto mb-4 h-3 w-3 rounded-full ${style.dot}`} />
          <h1 className={`font-serif text-6xl mb-3 ${style.text}`}>
            {weather.state}
          </h1>
          <p className="text-text-primary text-base leading-relaxed font-sans">
            {weather.sentence}
          </p>
          {weather.action && (
            <Link
              href={weather.action.href}
              className="mx-auto mt-6 rounded-full bg-text-primary text-white px-6 py-3 text-sm font-sans font-medium hover:bg-text-primary/90 transition-colors"
            >
              {weather.action.label} →
            </Link>
          )}
        </motion.section>
      )}

      {/* Today's and tomorrow's actionable rows (#79), between the hero
          and the heartbeat. */}
      {truth && (
        <TodayStrip
          rows={truth.strip}
          todayIso={truth.todayIso}
          tomorrowIso={truth.tomorrowIso}
        />
      )}

      {/* The heartbeat: Safe-to-Spend for the current Pay Period — one
          read for the whole glance (getHomeTruth), no second fetch. */}
      <SafeToSpendCard data={truth?.heartbeat ?? null} />

      <div className="flex flex-wrap items-center justify-center gap-3 mt-2 mb-6">
        {/* Honesty chip: absent only when the count is truly zero. */}
        {uncategorized > 0 && (
          <Link
            href="/dashboard/spending"
            className="inline-flex items-center gap-2 rounded-full border border-bg-secondary bg-white px-3 py-1.5 text-xs font-sans text-text-secondary hover:border-accent-gold transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            {uncategorized} transaction{uncategorized !== 1 ? "s" : ""} not yet
            categorized
          </Link>
        )}
        <Link
          href="/dashboard/spending"
          className="text-xs font-sans text-text-secondary underline underline-offset-4 hover:text-text-primary transition-colors"
        >
          where did it go →
        </Link>
        {/* Check-In stays launchable from Home (#60) until its Money Date
            merge (#61/#81) lands. */}
        <Link
          href="/dashboard/check-in"
          className="text-xs font-sans text-text-secondary underline underline-offset-4 hover:text-text-primary transition-colors"
        >
          Monthly Check-In →
        </Link>
      </div>

      {/* Quiet persistent nudge (#73): one flow, two fuels — manual is the
          fallback, and linking stays one tap away until it happens. */}
      {showLinkNudge && (
        <p className="text-center text-xs font-sans text-text-secondary mb-4">
          Running on manual entries.{" "}
          <Link
            href="/settings/connections"
            className="text-accent-gold hover:underline"
          >
            Link your accounts
          </Link>{" "}
          and balances stay current on their own.
        </p>
      )}

      {/* The "know yourselves" side-quest (#73): offered once, post-setup,
          dismissible forever (it moves to Settings). Never inside setup,
          never nagging. */}
      {showSideQuest && (
        <div
          data-side-quest
          className="mb-6 rounded-xl border border-bg-secondary bg-white px-4 py-3"
        >
          <p className="text-sm font-sans text-text-primary">
            When you have 20 calm minutes: the know-yourselves pair — your
            Money Scripts and Money Type.
          </p>
          <div className="mt-2 flex items-center gap-4">
            <Link
              href="/flow/scripts"
              className="text-sm font-sans font-medium text-accent-gold hover:underline"
            >
              Start the side-quest →
            </Link>
            <button
              type="button"
              onClick={handleDismissQuest}
              className="text-xs font-sans text-text-secondary hover:text-text-primary transition-colors"
            >
              Not now — don&apos;t ask again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
