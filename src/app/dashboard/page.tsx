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
import { SafeToSpendCard } from "@/components/dashboard/SafeToSpendCard";
import type { WeatherState } from "@/lib/heartbeat/weather";

const WEATHER_STYLE: Record<WeatherState, { dot: string; text: string }> = {
  Steady: { dot: "bg-success", text: "text-success" },
  Watch: { dot: "bg-warning", text: "text-warning" },
  Attention: { dot: "bg-error", text: "text-error" },
};

export default function DashboardPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [truth, setTruth] = useState<HomeTruth | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      getHomeTruth().then((data) => setTruth(data));
    }
  }, [isAuthenticated, authLoading]);

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

      {/* The heartbeat: Safe-to-Spend for the current Pay Period. */}
      <SafeToSpendCard />

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
    </div>
  );
}
