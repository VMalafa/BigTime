"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { FixedCostForm } from "@/components/flow/FixedCostForm";
import { FixedCostLineItemList } from "@/components/flow/FixedCostLineItemList";
import { RealityCheckCard } from "@/components/flow/RealityCheckCard";
import {
  useFlowStore,
  type FixedCostLineItem,
} from "@/lib/store/flow-store";

export default function FixedCostsPage() {
  const router = useRouter();
  const {
    spendingPlan,
    setCurrentStep,
    getTotalMonthlyIncome,
    getFixedCostsTotalMonthly,
    getSuggestedFixedCostsPercent,
  } = useFlowStore();

  const [editing, setEditing] = useState<FixedCostLineItem | null>(null);

  const items = spendingPlan?.fixedCostLineItems ?? [];
  const totalIncome = getTotalMonthlyIncome();
  const totalFixedCosts = getFixedCostsTotalMonthly();
  const derivedPercent = getSuggestedFixedCostsPercent();

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
