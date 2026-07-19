"use client";

// The Bonus Plan editor (#89): the standing windfall split, composed at
// the One Flow's Plan step (this page — #73's canonical CSP surface) with
// the ratified 70/15/15 pre-filled. Decided calmly in advance, so the
// Moment is a confirmation, not a debate. Save is one awaited intent,
// enabled only at 100 — the CSP card's own rule.

import { useEffect, useState } from "react";
import {
  getBonusPlan,
  saveBonusPlan,
  type BonusPlanData,
} from "@/app/actions/bonus";
import {
  validateBonusPlan,
  type BonusSplitPercents,
} from "@/lib/bonus/plan";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const FIELDS = [
  ["debtPercent", "Target debt"],
  ["goalPercent", "Spotlight Goal"],
  ["guiltFreePercent", "Guilt-free"],
] as const;

export function BonusPlanCard() {
  const [server, setServer] = useState<BonusPlanData | null>(null);
  const [values, setValues] = useState<BonusSplitPercents | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBonusPlan().then((plan) => {
      if (!plan) return;
      setServer(plan);
      setValues({
        debtPercent: plan.debtPercent,
        goalPercent: plan.goalPercent,
        guiltFreePercent: plan.guiltFreePercent,
      });
    });
  }, []);

  if (!values) return null;

  const invalid = validateBonusPlan(values);
  const dirty =
    server === null ||
    values.debtPercent !== server.debtPercent ||
    values.goalPercent !== server.goalPercent ||
    values.guiltFreePercent !== server.guiltFreePercent;

  async function save() {
    if (!values || invalid) return;
    setSaving(true);
    setError(null);
    const result = await saveBonusPlan(values);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setServer({ ...values, saved: true });
    setSavedAt(Date.now());
  }

  return (
    <Card padding="lg" className="mt-8" data-bonus-plan>
      <h2 className="font-serif text-xl text-text-primary mb-1">Bonus Plan</h2>
      <p className="text-text-secondary text-sm font-sans mb-4">
        When a real windfall lands, this is the split you already agreed to —
        decided calmly, applied in one confirm. Bonus money never inflates
        Safe-to-Spend.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        {FIELDS.map(([key, label]) => (
          <label
            key={key}
            className="flex flex-col gap-1 text-xs font-sans text-text-secondary"
          >
            {label}
            <span className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                value={values[key]}
                onChange={(e) =>
                  setValues({ ...values, [key]: e.target.valueAsNumber })
                }
                className="w-20 rounded-md border border-bg-secondary px-2 py-1.5 text-sm font-sans text-text-primary text-right"
              />
              %
            </span>
          </label>
        ))}
        <Button
          variant="secondary"
          size="sm"
          disabled={invalid !== null || !dirty || saving}
          onClick={save}
        >
          {saving ? "Saving…" : "Save the split"}
        </Button>
      </div>
      {invalid && (
        <p className="mt-2 text-xs font-sans text-warning">{invalid}</p>
      )}
      {error && <p className="mt-2 text-xs font-sans text-error">{error}</p>}
      {savedAt !== null && !dirty && !error && (
        <p className="mt-2 text-xs font-sans text-success">
          Saved — the next windfall already knows where it&apos;s going.
        </p>
      )}
    </Card>
  );
}
