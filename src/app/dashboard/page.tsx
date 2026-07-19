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
import { decideMilestone } from "@/app/actions/goals";
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
  const [milestoneHidden, setMilestoneHidden] = useState(false);

  // One-time celebration (#86): accept or dismiss, optimistic + rollback;
  // never re-raised either way.
  async function handleMilestone(decision: "ACCEPTED" | "DISMISSED") {
    if (!truth?.milestone) return;
    setMilestoneHidden(true);
    const result = await decideMilestone({
      id: truth.milestone.id,
      decision,
    });
    if (result.error) setMilestoneHidden(false);
  }

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
        {/* The Money Date merge (#81) landed: the ritual door replaces the
            old Check-In prompt (its history lives in the Date's archive;
            the /dashboard/check-in route still resolves). */}
        <Link
          href="/dashboard/money-date"
          className="text-xs font-sans text-text-secondary underline underline-offset-4 hover:text-text-primary transition-colors"
        >
          Money Date →
        </Link>
      </div>

      {/* The one-time celebration prompt (#86): celebratory, never a nag —
          one Milestone at a time, gone forever once decided. */}
      {truth?.milestone && !milestoneHidden && (
        <div
          data-milestone-prompt
          className="mb-4 rounded-xl border border-accent-gold/50 bg-accent-gold/10 px-4 py-3 text-center"
        >
          <p className="text-sm font-sans font-medium text-text-primary">
            🎉 {truth.milestone.title}
          </p>
          {truth.milestone.detail && (
            <p className="text-xs font-sans text-text-secondary mt-0.5">
              {truth.milestone.detail}
            </p>
          )}
          <div className="mt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleMilestone("ACCEPTED")}
              className="rounded-full bg-text-primary px-4 py-1 text-xs font-sans font-medium text-white hover:bg-text-primary/90 transition-colors"
            >
              Celebrate it — $
              {Math.round(truth.milestone.celebrationBudgetCents / 100)} of
              guilt-free
            </button>
            <button
              type="button"
              onClick={() => handleMilestone("DISMISSED")}
              className="text-xs font-sans text-text-secondary hover:text-text-primary transition-colors"
            >
              Not this one
            </button>
          </div>
        </div>
      )}

      {/* The quiet payday banner (#81): a raised Date waits without
          nagging; a moved one says where it went. */}
      {truth?.moneyDate && truth.moneyDate.status !== "COMPLETED" && (
        <Link
          href="/dashboard/money-date"
          data-money-date-banner
          className="mb-4 block rounded-xl border border-accent-gold/40 bg-accent-gold/5 px-4 py-3 text-center hover:border-accent-gold transition-colors"
        >
          <span className="text-sm font-sans text-text-primary">
            {truth.moneyDate.status === "RESCHEDULED" &&
            truth.moneyDate.scheduledFor
              ? `Money Date — waiting for you both, moved to ${new Date(`${truth.moneyDate.scheduledFor}T00:00:00.000Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}.`
              : "Payday. Your Money Date is ready — ten minutes, together."}
          </span>
        </Link>
      )}

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
