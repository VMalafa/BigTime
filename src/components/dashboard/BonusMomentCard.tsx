"use client";

// The Bonus Moment (#89): one card, one calm decision. The pre-committed
// split in real dollars, payoff impact in months, the Spotlight's jump —
// primary Confirm, secondary "adjust this once" (the standing plan is
// untouched), and a quiet out for a deposit that isn't a windfall.
// Awaited per-intent actions with optimistic hide + rollback (#29).

import { useState } from "react";
import {
  confirmBonusMoment,
  dismissBonusMoment,
  type BonusMomentCard as BonusMomentData,
} from "@/app/actions/bonus";
import { splitBonus, validateBonusPlan } from "@/lib/bonus/plan";

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function BonusMomentCard({
  moment,
  onDecided,
}: {
  moment: BonusMomentData;
  onDecided: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [override, setOverride] = useState({
    debtPercent: moment.plan.debtPercent,
    goalPercent: moment.plan.goalPercent,
    guiltFreePercent: moment.plan.guiltFreePercent,
  });

  const activeSplit = adjusting
    ? validateBonusPlan(override) === null
      ? splitBonus(moment.amountCents, override)
      : null
    : moment.split;
  const overrideInvalid = adjusting ? validateBonusPlan(override) : null;

  async function decide(action: () => Promise<{ ok?: boolean; error?: string }>) {
    setError(null);
    setHidden(true);
    // Rollback on ANY failure — an app-level error or a dropped request.
    // A thrown fetch must never leave the card silently hidden while the
    // server still thinks the Moment is open.
    let result: { ok?: boolean; error?: string };
    try {
      result = await action();
    } catch {
      result = { error: "That didn't save — try again." };
    }
    if (result.error) {
      setHidden(false);
      setError(result.error);
      return;
    }
    onDecided();
  }

  if (hidden) return null;

  const goalLine = moment.goal
    ? `${moment.goal.emoji ? `${moment.goal.emoji} ` : ""}${moment.goal.name}: ${moment.goal.beforePercent}% → ${moment.goal.afterPercent}%`
    : null;

  return (
    <div
      data-bonus-moment
      data-bonus-split={
        activeSplit
          ? `${activeSplit.debtCents}/${activeSplit.goalCents}/${activeSplit.guiltFreeCents}`
          : undefined
      }
      className="mb-4 rounded-xl border border-accent-gold/50 bg-accent-gold/10 px-4 py-4"
    >
      <p className="text-center text-sm font-sans text-text-secondary">
        A windfall landed — {moment.description}
      </p>
      <p className="text-center font-serif text-3xl text-text-primary mt-1">
        {dollars(moment.amountCents)}
      </p>

      {/* The plan applied, in real dollars. */}
      {activeSplit && (
        <div className="mt-3 space-y-1 text-sm font-sans text-text-primary">
          <div className="flex items-center justify-between">
            <span>
              {moment.targetDebtName
                ? `To ${moment.targetDebtName}`
                : "Toward debt"}
            </span>
            <span className="font-medium">{dollars(activeSplit.debtCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{moment.goal ? `To ${moment.goal.name}` : "Toward the Goal"}</span>
            <span className="font-medium">{dollars(activeSplit.goalCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Guilt-free — yours to enjoy</span>
            <span className="font-medium">
              {dollars(activeSplit.guiltFreeCents)}
            </span>
          </div>
        </div>
      )}

      {/* The concrete impact: months off the debt; the Spotlight's jump. */}
      {(moment.payoffMonthsSaved !== null || goalLine) && !adjusting && (
        <div className="mt-2 text-xs font-sans text-text-secondary text-center space-y-0.5">
          {moment.payoffMonthsSaved !== null && moment.payoffMonthsSaved > 0 && (
            <p>
              {moment.targetDebtName} paid off {moment.payoffMonthsSaved} month
              {moment.payoffMonthsSaved !== 1 ? "s" : ""} sooner.
            </p>
          )}
          {goalLine && <p>{goalLine}</p>}
          {moment.goal && moment.goal.milestonesCrossed >= 2 && (
            <p>
              That&apos;s {moment.goal.milestonesCrossed} Milestones in one leap
              — worth a real celebration.
            </p>
          )}
        </div>
      )}

      {/* "Adjust this once": a per-Moment override, plan unchanged. */}
      {adjusting && (
        <div className="mt-3">
          <div className="flex items-center justify-center gap-2">
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
                    value={override[key]}
                    onChange={(e) =>
                      setOverride({
                        ...override,
                        [key]: e.target.valueAsNumber,
                      })
                    }
                    className="w-14 rounded-md border border-bg-secondary px-1.5 py-1 text-sm text-text-primary text-right"
                  />
                  %
                </span>
              </label>
            ))}
          </div>
          {overrideInvalid && (
            <p className="mt-1 text-center text-xs font-sans text-warning">
              {overrideInvalid}
            </p>
          )}
          <p className="mt-1 text-center text-xs font-sans text-text-secondary">
            Just this once — your standing plan stays{" "}
            {moment.plan.debtPercent}/{moment.plan.goalPercent}/
            {moment.plan.guiltFreePercent}.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-2 text-center text-xs font-sans text-warning">{error}</p>
      )}

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={adjusting && overrideInvalid !== null}
          onClick={() =>
            decide(() =>
              confirmBonusMoment(
                adjusting ? { id: moment.id, override } : { id: moment.id }
              )
            )
          }
          className="rounded-full bg-text-primary px-5 py-1.5 text-xs font-sans font-medium text-white hover:bg-text-primary/90 transition-colors disabled:opacity-40"
        >
          Confirm the plan
        </button>
        {!adjusting ? (
          <button
            type="button"
            onClick={() => setAdjusting(true)}
            className="text-xs font-sans text-text-secondary underline underline-offset-4 hover:text-text-primary transition-colors"
          >
            adjust this once
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAdjusting(false)}
            className="text-xs font-sans text-text-secondary underline underline-offset-4 hover:text-text-primary transition-colors"
          >
            back to the plan
          </button>
        )}
        <button
          type="button"
          onClick={() => decide(() => dismissBonusMoment({ id: moment.id }))}
          className="text-xs font-sans text-text-secondary hover:text-text-primary transition-colors"
        >
          not a windfall
        </button>
      </div>
    </div>
  );
}
