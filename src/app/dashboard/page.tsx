// The one-truth Home (#77, Variant A from the #27 prototype): the
// household's state IS the screen. One word, one sentence, at most one
// action; Safe-to-Spend below; the honest uncategorized chip; a door into
// "where did it go". Deliberately absent: debt totals, income cards,
// charts, bonuses (#25/#27). Server data only (#53) — nothing here reads
// the UI-state store.
//
// Server-first since #109: the truth is computed during the server render
// and arrives in the initial HTML — no client-side action waterfall after
// hydration. Interactive pieces (milestone decision, bonus decision,
// side-quest dismissal) are small client leaves receiving data as props.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getHomeTruth } from "@/app/actions/home";
import { getSetupState } from "@/app/actions/setup";
import { SafeToSpendCard } from "@/components/dashboard/SafeToSpendCard";
import { TodayStrip } from "@/components/dashboard/TodayStrip";
import { BonusMomentSection } from "@/components/dashboard/BonusMomentSection";
import { MilestonePrompt } from "@/components/dashboard/MilestonePrompt";
import { SideQuestCard } from "@/components/dashboard/SideQuestCard";
import type { WeatherState } from "@/lib/heartbeat/weather";

const WEATHER_STYLE: Record<WeatherState, { dot: string; text: string }> = {
  Steady: { dot: "bg-success", text: "text-success" },
  Watch: { dot: "bg-warning", text: "text-warning" },
  Attention: { dot: "bg-error", text: "text-error" },
};

export default async function DashboardPage() {
  // Sequential on purpose: the one-truth read is a long chain on a single
  // pooled connection (#79) — a concurrent second request only starves the
  // pool and risks P2024 on whichever loses.
  const truth = await getHomeTruth();
  // The proxy already gates /dashboard; a null truth means the session
  // evaporated between the proxy and this render.
  if (!truth) redirect("/auth/login");
  const setup = await getSetupState();

  const showSideQuest = setup?.complete === true && !setup.sideQuestDismissed;
  const showLinkNudge = setup !== null && !setup.hasLinkedAccount;

  const weather = truth.weather;
  const style = weather ? WEATHER_STYLE[weather.state] : null;
  const uncategorized = truth.uncategorizedCount;

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
          one phone screen without scrolling — the hotel-lobby glance.
          Server-rendered; the entrance is a CSS animation (#109). */}
      {weather && style && (
        <section
          data-weather-state={weather.state}
          className="home-hero-enter flex-1 flex flex-col justify-center text-center py-10"
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
        </section>
      )}

      {/* Today's and tomorrow's actionable rows (#79), between the hero
          and the heartbeat. */}
      <TodayStrip
        rows={truth.strip}
        todayIso={truth.todayIso}
        tomorrowIso={truth.tomorrowIso}
      />

      {/* The heartbeat: Safe-to-Spend for the current Pay Period — one
          read for the whole glance (getHomeTruth), no second fetch. */}
      <SafeToSpendCard data={truth.heartbeat} />

      <div className="flex flex-wrap items-center justify-center gap-3 mt-2 mb-6">
        {/* Honesty chip: absent only when the count is truly zero. */}
        {uncategorized > 0 && (
          <Link
            href="/dashboard/spending"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-bg-secondary bg-white px-3.5 py-1.5 text-xs font-sans text-text-secondary hover:border-accent-gold transition-colors"
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
      {truth.milestone && <MilestonePrompt milestone={truth.milestone} />}

      {/* The one-confirm windfall (#89): the Bonus Plan applied to real
          dollars — one calm decision, oldest Moment first. */}
      {truth.bonus?.moment && <BonusMomentSection moment={truth.bonus.moment} />}

      {/* Planned → moved, gently (#89): one line after ~7 quiet days,
          never a nag. */}
      {truth.bonus?.reminder && (
        <p
          data-bonus-reminder
          className="mb-4 text-center text-xs font-sans text-text-secondary"
        >
          {truth.bonus.reminder}
        </p>
      )}

      {/* The quiet payday banner (#81): a raised Date waits without
          nagging; a moved one says where it went. */}
      {truth.moneyDate && truth.moneyDate.status !== "COMPLETED" && (
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
            className="text-accent-gold-deep hover:underline"
          >
            Link your accounts
          </Link>{" "}
          and balances stay current on their own.
        </p>
      )}

      {/* The "know yourselves" side-quest (#73): offered once, post-setup,
          dismissible forever (it moves to Settings). Never inside setup,
          never nagging. */}
      {showSideQuest && <SideQuestCard />}
    </div>
  );
}
