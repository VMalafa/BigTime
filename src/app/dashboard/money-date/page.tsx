"use client";

// The Money Date (#81 + #82): four guided cards every payday — Weather
// recap → one insight → one next action → the Goal, always last — and on
// the FIRST Date of each calendar month, three deep cards join before
// the close: Dial Drift, the CSP tune-up, and the subscription audit.
// Patterns, not verdicts; every deep card carries the counselor door.

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
import { saveSpendingPlan } from "@/app/actions/spending-plan";
import { saveBonusPlan } from "@/app/actions/bonus";
import { validateBonusPlan, type BonusSplitPercents } from "@/lib/bonus/plan";
import { investigateAction } from "@/lib/money-date/deep";
import { CSPSliders } from "@/components/flow/CSPSliders";
import { Button } from "@/components/ui/Button";
import type { SpendingPlanData } from "@/lib/store/flow-store";
import type { WeatherState } from "@/lib/heartbeat/weather";

const WEATHER_COLOR: Record<WeatherState, string> = {
  Steady: "text-success",
  Watch: "text-warning",
  Attention: "text-error",
};

const PRESENT_CHOICES = ["Both of us", "Just me"];

type CardKey =
  | "weather"
  | "insight"
  | "action"
  | "drift"
  | "csp"
  | "audit"
  | "bonus"
  | "goal";

function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

/** The quiet "talk this through?" door — the counselor scoped to this
 * card's context, on call for exactly the beat that got hard (#62). */
function CounselorDoor({ topic }: { topic: string }) {
  return (
    <Link
      href={`/partner/counselor?topic=${encodeURIComponent(topic)}`}
      className="mt-4 inline-block text-xs font-sans text-text-secondary underline underline-offset-4 hover:text-text-primary transition-colors"
    >
      talk this through? →
    </Link>
  );
}

export default function MoneyDatePage() {
  const router = useRouter();
  const [truth, setTruth] = useState<MoneyDateTruth | null>(null);
  const [step, setStep] = useState(0);
  const [present, setPresent] = useState<string>(PRESENT_CHOICES[0]);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleTo, setRescheduleTo] = useState("");
  const [planValues, setPlanValues] = useState<SpendingPlanData | null>(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [bonusValues, setBonusValues] = useState<BonusSplitPercents | null>(null);
  const [auditChoices, setAuditChoices] = useState<Map<string, "keep" | "investigate">>(
    new Map()
  );
  const [done, setDone] = useState(false);

  useEffect(() => {
    getMoneyDateTruth().then((data) => {
      setTruth(data);
      if (data?.deep?.plan) setPlanValues(data.deep.plan);
      if (data?.deep?.bonusPlan) {
        setBonusValues({
          debtPercent: data.deep.bonusPlan.debtPercent,
          goalPercent: data.deep.bonusPlan.goalPercent,
          guiltFreePercent: data.deep.bonusPlan.guiltFreePercent,
        });
      }
    });
  }, []);

  if (!truth) {
    return (
      <p className="text-sm font-sans text-text-secondary text-center py-16">
        Setting the table…
      </p>
    );
  }

  const { current, beats, deep } = truth;
  const open = current && current.status !== "COMPLETED";

  // The Bonus Plan tune-up (#89) joins only in months where a Moment
  // fired — the action layer already gated deep.bonusPlan on that.
  const sequence: CardKey[] = deep
    ? [
        "weather",
        "insight",
        "action",
        "drift",
        "csp",
        "audit",
        ...(deep.bonusPlan ? (["bonus"] as const) : []),
        "goal",
      ]
    : ["weather", "insight", "action", "goal"];
  const total = sequence.length;
  const cardKey = step < total ? sequence[step] : null;

  const investigations = [...auditChoices.entries()]
    .filter(([, choice]) => choice === "investigate")
    .map(([merchantPattern]) =>
      deep?.subscriptions.find((s) => s.merchantPattern === merchantPattern)
        ?.merchant ?? merchantPattern
    );

  async function advance() {
    // The CSP tune-up writes through the plan's awaited action (#50) —
    // most months a confirm-and-move-on; a failed save stays put.
    if (cardKey === "csp" && planValues && deep?.plan) {
      const changed =
        JSON.stringify({ ...planValues, fixedCostLineItems: [] }) !==
        JSON.stringify({ ...deep.plan, fixedCostLineItems: [] });
      if (changed) {
        const totalPct =
          planValues.fixedCostsPercent +
          planValues.savingsPercent +
          planValues.investmentsPercent +
          planValues.guiltFreePercent;
        if (totalPct !== 100) {
          setError("The four buckets must total 100% before moving on.");
          return;
        }
        setPlanSaving(true);
        setError(null);
        const saved = await saveSpendingPlan({
          fixedCostsPercent: planValues.fixedCostsPercent,
          savingsPercent: planValues.savingsPercent,
          investmentsPercent: planValues.investmentsPercent,
          guiltFreePercent: planValues.guiltFreePercent,
          fixedCostsOverridden: planValues.fixedCostsOverridden,
        });
        setPlanSaving(false);
        if ("error" in saved && saved.error) {
          // Rollback (#29): the sliders return to server truth.
          setPlanValues(deep.plan);
          setError(saved.error);
          return;
        }
      }
    }
    // The Bonus Plan tune-up saves the standing split the same way (#89):
    // awaited, validated to 100, rollback to server truth on a failed save.
    if (cardKey === "bonus" && bonusValues && deep?.bonusPlan) {
      const serverSplit = {
        debtPercent: deep.bonusPlan.debtPercent,
        goalPercent: deep.bonusPlan.goalPercent,
        guiltFreePercent: deep.bonusPlan.guiltFreePercent,
      };
      if (JSON.stringify(bonusValues) !== JSON.stringify(serverSplit)) {
        const invalid = validateBonusPlan(bonusValues);
        if (invalid) {
          setError(invalid);
          return;
        }
        setPlanSaving(true);
        setError(null);
        const saved = await saveBonusPlan(bonusValues);
        setPlanSaving(false);
        if (saved.error) {
          setBonusValues(serverSplit);
          setError(saved.error);
          return;
        }
      }
    }
    setError(null);
    setStep(step + 1);
  }

  async function finish() {
    if (!current || !beats) return;
    setFinishing(true);
    setError(null);
    const chosenAction = investigateAction(investigations) ?? beats.action;
    const result = await completeMoneyDate({
      id: current.id,
      presentNames: [present],
      beats: { ...beats, action: chosenAction },
    });
    setFinishing(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
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

  const eyebrow = (label: string) => (
    <p className="text-xs font-sans uppercase tracking-wide text-text-secondary mb-3">
      {label} · {step + 1} of {total}
    </p>
  );

  const nextButton = (label = "Next") => (
    <div className="mt-8 flex items-center justify-center gap-3">
      {step > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
          Back
        </Button>
      )}
      <Button onClick={advance} disabled={planSaving}>
        {planSaving ? "Saving…" : label}
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-md flex flex-col min-h-[70vh]" data-money-date>
      {!open && !done && (
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

      {open && !done && cardKey && cardKey !== "goal" && beats && (
        <AnimatePresence mode="wait">
          <motion.section
            key={cardKey}
            data-date-card={cardKey}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex flex-col justify-center text-center py-10"
          >
            {cardKey === "weather" && (
              <>
                {eyebrow("The period behind you")}
                <h1
                  className={`font-serif text-5xl ${WEATHER_COLOR[beats.weather.state]}`}
                >
                  {beats.weather.state}
                </h1>
                <p className="text-text-primary text-base leading-relaxed font-sans mt-4">
                  {beats.weather.sentence}
                </p>
                {nextButton()}
              </>
            )}

            {cardKey === "insight" && (
              <>
                {eyebrow("Patterns, not verdicts")}
                <h1 className="font-serif text-3xl text-text-primary">
                  One insight
                </h1>
                <p className="text-text-primary text-base leading-relaxed font-sans mt-4">
                  {beats.insight}
                </p>
                {nextButton()}
              </>
            )}

            {cardKey === "action" && (
              <>
                {eyebrow("Just one")}
                <h1 className="font-serif text-3xl text-text-primary">
                  One next action
                </h1>
                <p className="text-text-primary text-base leading-relaxed font-sans mt-4">
                  {beats.action}
                </p>
                {nextButton()}
              </>
            )}

            {cardKey === "drift" && deep && (
              <>
                {eyebrow("The monthly look")}
                <h1 className="font-serif text-3xl text-text-primary">
                  Dial Drift
                </h1>
                {deep.dialDrift.suppressed ? (
                  <p className="text-text-secondary text-sm font-sans mt-4">
                    Dial Drift needs at least 5 dial-categorized guilt-free
                    transactions last month to read honestly — not there
                    yet. No verdicts on thin data.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2 text-left">
                    <p className="text-text-secondary text-xs font-sans text-center mb-2">
                      What you said matters, next to where the fun money
                      actually went. Information, not judgment.
                    </p>
                    {deep.dialDrift.rows.slice(0, 5).map((row) => (
                      <div
                        key={row.category}
                        className="flex items-baseline justify-between rounded-lg bg-white border border-bg-secondary px-3 py-2 text-sm font-sans"
                      >
                        <span className="text-text-primary">{row.name}</span>
                        <span className="text-text-secondary text-xs">
                          you said {row.statedLevel}/10 · got{" "}
                          {Math.round(row.sharePercent)}% (
                          {dollars(row.actualCents)})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <CounselorDoor topic="We're looking at our Dial Drift — where our stated Money Dial priorities and our actual guilt-free spending don't line up." />
                {nextButton()}
              </>
            )}

            {cardKey === "csp" && deep && (
              <>
                {eyebrow("The monthly look")}
                <h1 className="font-serif text-3xl text-text-primary">
                  Plan tune-up
                </h1>
                {planValues ? (
                  <div className="mt-4 text-left">
                    <p className="text-text-secondary text-xs font-sans text-center mb-3">
                      Most months this is a nod and a Next. Nudge the
                      buckets only if life changed.
                    </p>
                    <CSPSliders
                      values={planValues}
                      onChange={setPlanValues}
                      totalIncome={0}
                    />
                  </div>
                ) : (
                  <p className="text-text-secondary text-sm font-sans mt-4">
                    No Conscious Spending Plan yet — set one on the Plan
                    page and it&apos;ll be here next month.
                  </p>
                )}
                <CounselorDoor topic="We're tuning our Conscious Spending Plan percentages and could use help talking through the trade-offs." />
                {nextButton(planValues ? "Looks right — Next" : "Next")}
              </>
            )}

            {cardKey === "audit" && deep && (
              <>
                {eyebrow("The monthly look")}
                <h1 className="font-serif text-3xl text-text-primary">
                  Subscription audit
                </h1>
                {deep.subscriptions.length === 0 ? (
                  <p className="text-text-secondary text-sm font-sans mt-4">
                    No recurring subscription charges detected in the feed —
                    nothing to audit this month.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2 text-left">
                    <p className="text-text-secondary text-xs font-sans text-center mb-2">
                      The app never cancels anything — “investigate” just
                      becomes your one next action.
                    </p>
                    {deep.subscriptions.map((sub) => {
                      const choice =
                        auditChoices.get(sub.merchantPattern) ?? "keep";
                      return (
                        <div
                          key={sub.merchantPattern}
                          className="flex items-center justify-between gap-2 rounded-lg bg-white border border-bg-secondary px-3 py-2 text-sm font-sans"
                        >
                          <span className="min-w-0 truncate text-text-primary">
                            {sub.merchant}
                            <span className="text-text-secondary text-xs">
                              {" "}
                              · {dollars(sub.typicalAmountCents)}/
                              {sub.cadence.toLowerCase()}
                            </span>
                          </span>
                          <span className="flex shrink-0 gap-1">
                            {(["keep", "investigate"] as const).map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() =>
                                  setAuditChoices((current) =>
                                    new Map(current).set(
                                      sub.merchantPattern,
                                      option
                                    )
                                  )
                                }
                                className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                                  choice === option
                                    ? "border-accent-gold bg-accent-gold/10 text-accent-gold"
                                    : "border-bg-secondary bg-white text-text-secondary"
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <CounselorDoor topic="We're doing our subscription audit and disagree about what to keep." />
                {nextButton()}
              </>
            )}

            {cardKey === "bonus" && deep?.bonusPlan && bonusValues && (
              <>
                {eyebrow("The monthly look")}
                <h1 className="font-serif text-3xl text-text-primary">
                  Bonus Plan
                </h1>
                <p className="text-text-secondary text-xs font-sans mt-3">
                  A windfall landed this month. Still the split you&apos;d
                  choose calmly? Most months this is a nod and a Next.
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  {(
                    [
                      ["debtPercent", "Debt"],
                      ["goalPercent", "Goal"],
                      ["guiltFreePercent", "Guilt-free"],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex flex-col items-center gap-1 text-xs font-sans text-text-secondary"
                    >
                      {label}
                      <span className="flex items-center gap-0.5">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={bonusValues[key]}
                          onChange={(e) =>
                            setBonusValues({
                              ...bonusValues,
                              [key]: e.target.valueAsNumber,
                            })
                          }
                          className="w-16 rounded-md border border-bg-secondary px-2 py-1.5 text-sm font-sans text-text-primary text-right"
                        />
                        %
                      </span>
                    </label>
                  ))}
                </div>
                <CounselorDoor topic="We're revisiting our Bonus Plan — the standing split for windfalls — and want to talk through the priorities." />
                {nextButton("Looks right — Next")}
              </>
            )}
          </motion.section>
        </AnimatePresence>
      )}

      {open && !done && cardKey === "goal" && (
        <section
          data-date-card="goal"
          className="flex-1 flex flex-col justify-center text-center py-10"
        >
          {eyebrow("Always end on the dream")}
          {truth.spotlightGoal ? (
            <>
              <h1 className="font-serif text-4xl text-accent-gold">
                {truth.spotlightGoal.emoji
                  ? `${truth.spotlightGoal.emoji} `
                  : ""}
                {truth.spotlightGoal.name}
              </h1>
              <div className="mx-auto mt-4 w-full max-w-xs">
                <div className="h-2 rounded-full bg-bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-accent-gold"
                    style={{ width: `${truth.spotlightGoal.percentFunded}%` }}
                  />
                </div>
                <p className="mt-2 text-sm font-sans text-text-secondary">
                  {truth.spotlightGoal.percentFunded}% funded
                  {truth.spotlightGoal.sliceCents > 0
                    ? ` · a ${(truth.spotlightGoal.sliceCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} slice every paycheck`
                    : ""}
                </p>
              </div>
            </>
          ) : (
            <>
              <h1 className="font-serif text-3xl text-accent-gold">
                Pick the goal this is all for
              </h1>
              <p className="text-text-primary text-base leading-relaxed font-sans mt-4">
                The Spotlight Goal lives here soon — one dream, funded a
                slice at a time, closing every Money Date. Until then, hold
                the picture of it together.
              </p>
            </>
          )}
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              Back
            </Button>
            <Button onClick={() => setStep(total)}>Finish the Date</Button>
          </div>
        </section>
      )}

      {open && !done && step === total && (
        <section
          data-date-card="finish"
          className="flex-1 flex flex-col justify-center text-center py-10"
        >
          <h1 className="font-serif text-3xl text-text-primary">
            Who was here?
          </h1>
          {investigations.length > 0 && (
            <p className="text-sm font-sans text-text-secondary mt-2">
              Your one next action: {investigateAction(investigations)}
            </p>
          )}
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

      {done && (
        <section
          data-date-card="kept"
          className="flex-1 flex flex-col justify-center text-center py-10"
        >
          <h1 className="font-serif text-4xl text-success">Kept ✓</h1>
          <p className="text-sm font-sans text-text-secondary mt-3">
            {investigations.length > 0
              ? `Ten minutes, together — and one action: ${investigateAction(investigations)}`
              : "Ten minutes, together — see you next payday."}
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
      {open && !done && step === 0 && (
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
