"use client";

// The Money Date (#81, ratified in #62): four guided cards, swiped in
// order, together — Weather recap → one insight → one next action →
// the Spotlight Goal, always last. Ten minutes, ≤10 taps, ending on the
// dream. Everything derives live; the finish records the kept Date.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  completeMoneyDate,
  getMoneyDateTruth,
  rescheduleMoneyDate,
  type MoneyDateTruth,
} from "@/app/actions/money-date";
import { Button } from "@/components/ui/Button";
import type { WeatherState } from "@/lib/heartbeat/weather";

const WEATHER_COLOR: Record<WeatherState, string> = {
  Steady: "text-success",
  Watch: "text-warning",
  Attention: "text-error",
};

const PRESENT_CHOICES = ["Both of us", "Just me"];

function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function MoneyDatePage() {
  const router = useRouter();
  const [truth, setTruth] = useState<MoneyDateTruth | null>(null);
  const [step, setStep] = useState(0);
  const [present, setPresent] = useState<string>(PRESENT_CHOICES[0]);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleTo, setRescheduleTo] = useState("");

  useEffect(() => {
    getMoneyDateTruth().then(setTruth);
  }, []);

  if (!truth) {
    return (
      <p className="text-sm font-sans text-text-secondary text-center py-16">
        Setting the table…
      </p>
    );
  }

  const { current, beats } = truth;
  const open = current && current.status !== "COMPLETED";

  async function finish() {
    if (!current || !beats) return;
    setFinishing(true);
    setError(null);
    const result = await completeMoneyDate({
      id: current.id,
      presentNames: [present],
      beats,
    });
    setFinishing(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStep(5);
  }

  async function moveTo(dateIso: string) {
    if (!current) return;
    setError(null);
    const result = await rescheduleMoneyDate({ id: current.id, toDate: dateIso });
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard");
  }

  // The card sequence, only while a Date is open (or just finished).
  const cards =
    open && beats
      ? [
          {
            key: "weather",
            title: beats.weather.state,
            titleClass: `font-serif text-5xl ${WEATHER_COLOR[beats.weather.state]}`,
            eyebrow: "The period behind you",
            body: beats.weather.sentence,
          },
          {
            key: "insight",
            title: "One insight",
            titleClass: "font-serif text-3xl text-text-primary",
            eyebrow: "Patterns, not verdicts",
            body: beats.insight,
          },
          {
            key: "action",
            title: "One next action",
            titleClass: "font-serif text-3xl text-text-primary",
            eyebrow: "Just one",
            body: beats.action,
          },
          {
            key: "goal",
            title: "Pick the goal this is all for",
            titleClass: "font-serif text-3xl text-accent-gold",
            eyebrow: "Always end on the dream",
            body:
              "The Spotlight Goal lives here soon — one dream, funded a slice at a time, closing every Money Date. Until then, hold the picture of it together.",
          },
        ]
      : [];

  return (
    <div className="mx-auto max-w-md flex flex-col min-h-[70vh]" data-money-date>
      {!open && step !== 5 && (
        <div className="text-center py-10">
          <h1 className="font-serif text-3xl text-text-primary mb-2">
            Money Date
          </h1>
          <p className="text-sm font-sans text-text-secondary">
            {current?.status === "COMPLETED"
              ? "This period's Date is kept — see it in the archive below."
              : "No Date is raised yet — it arrives with the next paycheck."}
          </p>
        </div>
      )}

      {open && step < 4 && beats && (
        <AnimatePresence mode="wait">
          <motion.section
            key={cards[step].key}
            data-date-card={cards[step].key}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex flex-col justify-center text-center py-10"
          >
            <p className="text-xs font-sans uppercase tracking-wide text-text-secondary mb-3">
              {cards[step].eyebrow} · {step + 1} of 4
            </p>
            <h1 className={cards[step].titleClass}>{cards[step].title}</h1>
            <p className="text-text-primary text-base leading-relaxed font-sans mt-4">
              {cards[step].body}
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              <Button onClick={() => setStep(step + 1)}>
                {step === 3 ? "Finish the Date" : "Next"}
              </Button>
            </div>
          </motion.section>
        </AnimatePresence>
      )}

      {open && step === 4 && (
        <section
          data-date-card="finish"
          className="flex-1 flex flex-col justify-center text-center py-10"
        >
          <h1 className="font-serif text-3xl text-text-primary">
            Who was here?
          </h1>
          <div className="mt-4 flex items-center justify-center gap-2">
            {PRESENT_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setPresent(choice)}
                className={`rounded-full border px-4 py-1.5 text-sm font-sans transition-colors ${
                  present === choice
                    ? "border-accent-gold bg-accent-gold/10 text-accent-gold"
                    : "border-bg-secondary bg-white text-text-secondary"
                }`}
              >
                {choice}
              </button>
            ))}
          </div>
          <div className="mt-6">
            <Button onClick={finish} disabled={finishing}>
              {finishing ? "Recording…" : "Mark it kept"}
            </Button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section
          data-date-card="kept"
          className="flex-1 flex flex-col justify-center text-center py-10"
        >
          <h1 className="font-serif text-4xl text-success">Kept ✓</h1>
          <p className="text-sm font-sans text-text-secondary mt-3">
            Ten minutes, together — see you next payday.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 text-sm font-sans text-accent-gold hover:underline"
          >
            Back to Home →
          </Link>
        </section>
      )}

      {/* Travel shift (#62): one tap to a chosen evening; moved, never
          skipped — a moved Date still counts as kept. */}
      {open && step === 0 && (
        <div className="border-t border-bg-secondary pt-4 pb-2 text-center">
          <p className="text-xs font-sans text-text-secondary mb-2">
            Not together tonight? Move it — a moved Date still counts.
          </p>
          <div className="flex items-center justify-center gap-2">
            <input
              type="date"
              aria-label="Move to evening"
              value={rescheduleTo}
              onChange={(e) => setRescheduleTo(e.target.value)}
              className="rounded-lg border border-bg-secondary px-2 py-1 text-sm font-sans"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!rescheduleTo}
              onClick={() => moveTo(rescheduleTo)}
            >
              Move it
            </Button>
          </div>
          {current?.status === "RESCHEDULED" && current.scheduledFor && (
            <p className="text-xs font-sans text-text-secondary mt-2">
              Waiting for you both — moved to {dateLabel(current.scheduledFor)}.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-sans text-error text-center mb-4">
          {error}
        </p>
      )}

      {/* Archive: every kept Date, and the Monthly Check-In pre-history —
          read-only, nothing the household wrote is lost. */}
      {(truth.archive.length > 0 || truth.preHistory.length > 0) && (
        <section aria-label="Money Date archive" className="mt-10">
          <h2 className="font-serif text-xl text-text-primary mb-3">Archive</h2>
          <ul className="space-y-2">
            {truth.archive.map((kept) => (
              <li
                key={kept.id}
                className="rounded-lg bg-white border border-bg-secondary px-4 py-2.5 text-sm font-sans"
              >
                <span className="text-text-primary">
                  Payday {dateLabel(kept.periodStart)}
                </span>
                <span className="text-text-secondary">
                  {" "}
                  · kept{kept.scheduledFor ? " (moved)" : ""} ·{" "}
                  {kept.presentNames.join(", ") || "—"}
                </span>
              </li>
            ))}
          </ul>
          {truth.preHistory.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-sans uppercase tracking-wide text-text-secondary mb-2">
                Before the Money Date: Monthly Check-Ins
              </h3>
              <ul className="space-y-2">
                {truth.preHistory.map((checkIn) => (
                  <li
                    key={checkIn.month}
                    className="rounded-lg bg-bg-secondary/40 px-4 py-2.5 text-sm font-sans"
                  >
                    <p className="text-text-primary font-medium">
                      {checkIn.month}
                    </p>
                    {checkIn.wentWell && (
                      <p className="text-text-secondary text-xs mt-0.5">
                        Went well: {checkIn.wentWell}
                      </p>
                    )}
                    {checkIn.feltHard && (
                      <p className="text-text-secondary text-xs mt-0.5">
                        Felt hard: {checkIn.feltHard}
                      </p>
                    )}
                    {checkIn.toAdjust && (
                      <p className="text-text-secondary text-xs mt-0.5">
                        To adjust: {checkIn.toAdjust}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
