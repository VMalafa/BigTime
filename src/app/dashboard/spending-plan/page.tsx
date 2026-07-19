"use client";

// The Conscious Spending Plan — the canonical surface (#73 retired the
// /flow twin). Save is one awaited intent, enabled only at 100%.

import { useState } from "react";
import { motion } from "framer-motion";
import { CSPSliders } from "@/components/flow/CSPSliders";
import { RealityCheckCard } from "@/components/flow/RealityCheckCard";
import { BonusPlanCard } from "@/components/dashboard/BonusPlanCard";
import { Button } from "@/components/ui/Button";
import type { SpendingPlanData } from "@/lib/store/flow-store";
import { useSpendingPlan } from "@/lib/hooks/useSpendingPlan";
import { useIncomeData } from "@/lib/hooks/useIncomeData";
import { CSP_RANGES } from "@/lib/constants/csp-ranges";
import { formatCurrency, formatPercent } from "@/lib/utils/format";

const DEFAULT_PLAN: SpendingPlanData = {
  fixedCostsPercent: CSP_RANGES.fixedCosts.min,
  savingsPercent: CSP_RANGES.savings.min,
  investmentsPercent: CSP_RANGES.investments.min,
  guiltFreePercent: CSP_RANGES.guiltFree.min,
  fixedCostLineItems: [],
  fixedCostsOverridden: false,
};

export default function SpendingPlanPage() {
  const { spendingPlan, savePlan, error: saveError } = useSpendingPlan();
  const { totalMonthlyIncome: totalIncome } = useIncomeData();
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const totalFixedCosts = (spendingPlan?.fixedCostLineItems ?? []).reduce(
    (sum, i) => sum + i.monthlyAmount,
    0
  );
  const suggestedFixedCostsPercent =
    totalIncome > 0 ? Math.round((totalFixedCosts / totalIncome) * 100) : 0;

  const initial: SpendingPlanData = spendingPlan ?? DEFAULT_PLAN;
  // Pre-seed the Fixed Costs slider with the derived value the first time the
  // user lands here, as long as they haven't manually overridden it yet.
  const seededFixedCosts =
    !initial.fixedCostsOverridden && suggestedFixedCostsPercent > 0
      ? suggestedFixedCostsPercent
      : initial.fixedCostsPercent;

  const [values, setValues] = useState<SpendingPlanData>({
    ...initial,
    fixedCostsPercent: seededFixedCosts,
  });

  // "Adjust state while rendering" pattern: if the user edits line items on
  // Fixed Costs and comes back without having overridden the slider, keep
  // local state in sync with the refreshed suggested value.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [lastSeenSuggested, setLastSeenSuggested] = useState(
    suggestedFixedCostsPercent
  );
  if (
    !values.fixedCostsOverridden &&
    suggestedFixedCostsPercent !== lastSeenSuggested
  ) {
    setLastSeenSuggested(suggestedFixedCostsPercent);
    setValues({
      ...values,
      fixedCostsPercent: suggestedFixedCostsPercent,
    });
  }

  const total =
    values.fixedCostsPercent +
    values.savingsPercent +
    values.investmentsPercent +
    values.guiltFreePercent;

  const isOver = total > 100;
  const delta = total - 100;

  const showResetAffordance =
    values.fixedCostsOverridden &&
    suggestedFixedCostsPercent > 0 &&
    values.fixedCostsPercent !== suggestedFixedCostsPercent;

  function handleValuesChange(next: SpendingPlanData) {
    // If the Fixed Costs slider moved, mark the plan as overridden so future
    // line-item changes don't silently overwrite the user's choice.
    if (next.fixedCostsPercent !== values.fixedCostsPercent) {
      if (!next.fixedCostsOverridden) {
        next = { ...next, fixedCostsOverridden: true };
      }
    }
    setSavedAt(null);
    setValues(next);
  }

  function handleResetToSuggested() {
    setSavedAt(null);
    setValues((prev) => ({
      ...prev,
      fixedCostsPercent: suggestedFixedCostsPercent,
      fixedCostsOverridden: false,
    }));
  }

  function handleBalance() {
    const remainingDelta = 100 - total;
    if (remainingDelta === 0) return;

    // Distribute the delta across Savings / Investments / Guilt-Free only,
    // preserving their relative weights. Fixed Costs is intentionally left
    // alone per the "don't auto-rebalance" design decision.
    const flexibleTotal =
      values.savingsPercent + values.investmentsPercent + values.guiltFreePercent;
    const safeBase = flexibleTotal || 1;

    const savings = Math.max(
      0,
      Math.round(
        values.savingsPercent + (values.savingsPercent / safeBase) * remainingDelta
      )
    );
    const investments = Math.max(
      0,
      Math.round(
        values.investmentsPercent +
          (values.investmentsPercent / safeBase) * remainingDelta
      )
    );
    const guiltFree = Math.max(
      0,
      100 - values.fixedCostsPercent - savings - investments
    );

    setSavedAt(null);
    setValues({
      ...values,
      savingsPercent: savings,
      investmentsPercent: investments,
      guiltFreePercent: guiltFree,
    });
  }

  async function handleSave() {
    setIsSaving(true);
    const saved = await savePlan({
      fixedCostsPercent: values.fixedCostsPercent,
      savingsPercent: values.savingsPercent,
      investmentsPercent: values.investmentsPercent,
      guiltFreePercent: values.guiltFreePercent,
      fixedCostsOverridden: values.fixedCostsOverridden,
    });
    setIsSaving(false);
    if (saved) setSavedAt(Date.now());
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.h1
        className="font-serif text-3xl text-text-primary mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Conscious Spending Plan
      </motion.h1>
      <p className="text-text-secondary font-sans text-sm mb-8">
        Allocate every dollar with intention, not restriction. The four
        buckets must total 100%.
      </p>

      <div className="space-y-8">
        <RealityCheckCard
          totalIncome={totalIncome}
          totalFixedCosts={totalFixedCosts}
          derivedPercent={suggestedFixedCostsPercent}
        />

        {showResetAffordance && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between rounded-md border border-bg-secondary bg-white px-4 py-3"
          >
            <p className="text-sm text-text-secondary">
              Derived from your line items:{" "}
              <span className="font-semibold text-text-primary">
                {formatPercent(suggestedFixedCostsPercent)}
              </span>
            </p>
            <Button variant="ghost" size="sm" onClick={handleResetToSuggested}>
              Reset to suggested
            </Button>
          </motion.div>
        )}

        <CSPSliders
          values={values}
          onChange={handleValuesChange}
          totalIncome={totalIncome}
        />

        {total !== 100 && (
          <div
            className={`rounded-lg px-5 py-4 border ${
              isOver
                ? "border-error bg-error/10"
                : "border-warning bg-warning/10"
            }`}
            role="status"
            aria-live="polite"
          >
            <p
              className={`font-sans font-medium ${
                isOver ? "text-error" : "text-warning"
              }`}
            >
              {isOver ? "Over budget" : "Under budget"} by{" "}
              {formatPercent(Math.abs(delta))} (
              {formatCurrency((Math.abs(delta) / 100) * totalIncome)})
            </p>
            <p className="text-sm text-text-secondary mt-1">
              Adjust Savings, Investments, or Guilt-Free to reach 100%, or tap
              the button below to distribute across those flexible buckets.
            </p>
            <div className="mt-3">
              <Button variant="secondary" onClick={handleBalance}>
                Balance remaining across flexible buckets
              </Button>
            </div>
          </div>
        )}

        {saveError && (
          <p role="alert" className="text-sm text-error font-sans">
            {saveError}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={total !== 100 || isSaving}
          >
            {isSaving ? "Saving…" : "Save plan"}
          </Button>
          {savedAt !== null && (
            <span className="text-sm font-sans text-success" role="status">
              Plan saved.
            </span>
          )}
        </div>

        {/* The standing windfall split (#89), composed at the Plan step
            with the ratified default pre-filled. */}
        <BonusPlanCard />
      </div>
    </div>
  );
}
