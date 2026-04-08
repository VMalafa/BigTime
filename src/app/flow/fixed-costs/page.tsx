"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { FixedCostForm } from "@/components/flow/FixedCostForm";
import { FixedCostLineItemList } from "@/components/flow/FixedCostLineItemList";
import { RealityCheckCard } from "@/components/flow/RealityCheckCard";
import {
  useFlowStore,
  type FixedCostLineItem,
} from "@/lib/store/flow-store";
import { formatCurrency } from "@/lib/utils/format";

export default function FixedCostsPage() {
  const router = useRouter();
  const {
    spendingPlan,
    debts,
    setCurrentStep,
    getTotalMonthlyIncome,
    getDebtMinimumsTotal,
    getFixedCostsLineItemsTotal,
    getFixedCostsTotalMonthly,
    getSuggestedFixedCostsPercent,
  } = useFlowStore();

  const [editing, setEditing] = useState<FixedCostLineItem | null>(null);

  const items = spendingPlan?.fixedCostLineItems ?? [];
  const totalIncome = getTotalMonthlyIncome();
  const debtMinimumsTotal = getDebtMinimumsTotal();
  const lineItemsTotal = getFixedCostsLineItemsTotal();
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
        {debtMinimumsTotal > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-lg border border-accent-gold/30 bg-accent-gold/5 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-serif text-base text-text-primary">
                  Included automatically
                </p>
                <p className="text-sm text-text-secondary mt-0.5">
                  {debts.length} debt minimum payment
                  {debts.length === 1 ? "" : "s"} from your Debts step. Edit
                  them there — no need to re-enter below.
                </p>
              </div>
              <p className="text-lg font-semibold text-text-primary whitespace-nowrap">
                {formatCurrency(debtMinimumsTotal)}
                <span className="text-sm font-normal text-text-secondary">
                  /mo
                </span>
              </p>
            </div>
          </motion.div>
        )}

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
          lineItemsTotal={lineItemsTotal}
          debtMinimumsTotal={debtMinimumsTotal}
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
