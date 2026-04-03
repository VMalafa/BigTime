"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { CSPSliders } from "@/components/flow/CSPSliders";
import { Button } from "@/components/ui/Button";
import { useFlowStore, type SpendingPlanData } from "@/lib/store/flow-store";
import { CSP_RANGES } from "@/lib/constants/csp-ranges";

const DEFAULT_PLAN: SpendingPlanData = {
  fixedCostsPercent: CSP_RANGES.fixedCosts.min,
  savingsPercent: CSP_RANGES.savings.min,
  investmentsPercent: CSP_RANGES.investments.min,
  guiltFreePercent: CSP_RANGES.guiltFree.min,
};

export default function SpendingPlanPage() {
  const router = useRouter();
  const { spendingPlan, setSpendingPlan, setCurrentStep, getTotalMonthlyIncome } =
    useFlowStore();

  const totalIncome = getTotalMonthlyIncome();

  const [values, setValues] = useState<SpendingPlanData>(
    spendingPlan ?? DEFAULT_PLAN
  );

  const total =
    values.fixedCostsPercent +
    values.savingsPercent +
    values.investmentsPercent +
    values.guiltFreePercent;

  const isOver = total > 100;

  function handleBalance() {
    const remaining = 100 - total;
    if (remaining <= 0) return;

    // Distribute remaining proportionally based on current values
    const currentTotal = total || 1; // avoid divide by zero
    const updated: SpendingPlanData = {
      fixedCostsPercent: Math.round(
        values.fixedCostsPercent + (values.fixedCostsPercent / currentTotal) * remaining
      ),
      savingsPercent: Math.round(
        values.savingsPercent + (values.savingsPercent / currentTotal) * remaining
      ),
      investmentsPercent: Math.round(
        values.investmentsPercent + (values.investmentsPercent / currentTotal) * remaining
      ),
      guiltFreePercent: 0,
    };
    // Assign remainder to guilt-free to guarantee exactly 100%
    updated.guiltFreePercent =
      100 -
      updated.fixedCostsPercent -
      updated.savingsPercent -
      updated.investmentsPercent;

    setValues(updated);
  }

  function handleNext() {
    setSpendingPlan(values);
    setCurrentStep(5);
    router.push("/flow/money-dials");
  }

  function handleBack() {
    router.push("/flow/income");
  }

  return (
    <StepWrapper
      title="Your Conscious Spending Plan"
      subtitle="Ramit Sethi's system: allocate every dollar with intention, not restriction."
    >
      <div className="space-y-8">
        <CSPSliders
          values={values}
          onChange={setValues}
          totalIncome={totalIncome}
        />

        {total !== 100 && !isOver && (
          <div className="flex justify-center">
            <Button variant="secondary" onClick={handleBalance}>
              Balance Remaining
            </Button>
          </div>
        )}

        <FlowNavigation
          onBack={handleBack}
          onNext={handleNext}
          nextLabel="Continue"
          nextDisabled={total !== 100}
          showBack
        />
      </div>
    </StepWrapper>
  );
}
