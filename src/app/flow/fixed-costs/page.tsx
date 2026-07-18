"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { FixedCostForm } from "@/components/flow/FixedCostForm";
import { FixedCostProposalsPanel } from "@/components/proposals/FixedCostProposalsPanel";
import { FixedCostLineItemList } from "@/components/flow/FixedCostLineItemList";
import { RealityCheckCard } from "@/components/flow/RealityCheckCard";
import {
  useFlowStore,
  type FixedCostLineItem,
} from "@/lib/store/flow-store";
import { useIncomeData } from "@/lib/hooks/useIncomeData";
import { useSpendingPlan } from "@/lib/hooks/useSpendingPlan";

export default function FixedCostsPage() {
  const router = useRouter();
  const setCurrentStep = useFlowStore((s) => s.setCurrentStep);
  const { spendingPlan } = useSpendingPlan();
  const { totalMonthlyIncome: totalIncome } = useIncomeData();

  const [editing, setEditing] = useState<FixedCostLineItem | null>(null);

  const items = spendingPlan?.fixedCostLineItems ?? [];
  const totalFixedCosts = items.reduce((sum, i) => sum + i.monthlyAmount, 0);
  const derivedPercent =
    totalIncome > 0 ? Math.round((totalFixedCosts / totalIncome) * 100) : 0;

  function handleNext() {
    setCurrentStep(4);
    router.push("/flow/spending-plan");
  }

  function handleBack() {
    router.push("/flow/income");
  }

  return (
    <StepWrapper
      title="What's actually locked in?"
      subtitle="List the monthly bills you have to pay. We'll use this to suggest a Fixed Costs bucket on the next step."
    >
      <div className="space-y-8">
        {/* Proposals first (linked path); manual entry stays below for
            whatever the feed missed. */}
        <FixedCostProposalsPanel />

        <FixedCostForm
          key={editing?.id ?? "new"}
          editing={editing}
          onDone={() => setEditing(null)}
        />

        <FixedCostLineItemList items={items} onEdit={setEditing} />

        <RealityCheckCard
          totalIncome={totalIncome}
          totalFixedCosts={totalFixedCosts}
          derivedPercent={derivedPercent}
        />

        <FlowNavigation
          onBack={handleBack}
          onNext={handleNext}
          nextLabel={items.length === 0 ? "Skip for now" : "Continue"}
          showBack
        />
      </div>
    </StepWrapper>
  );
}
