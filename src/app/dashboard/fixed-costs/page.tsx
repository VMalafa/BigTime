"use client";

// Fixed Costs — the canonical surface (#73 retired the /flow twin; one
// surface per entity per #25). Proposals first on the linked path; manual
// entry below for whatever the feed missed.

import { useState } from "react";
import { motion } from "framer-motion";
import { FixedCostForm } from "@/components/flow/FixedCostForm";
import { FixedCostProposalsPanel } from "@/components/proposals/FixedCostProposalsPanel";
import { FixedCostLineItemList } from "@/components/flow/FixedCostLineItemList";
import { RealityCheckCard } from "@/components/flow/RealityCheckCard";
import type { FixedCostLineItem } from "@/lib/store/flow-store";
import { useIncomeData } from "@/lib/hooks/useIncomeData";
import { useSpendingPlan } from "@/lib/hooks/useSpendingPlan";

export default function FixedCostsPage() {
  const { spendingPlan } = useSpendingPlan();
  const { totalMonthlyIncome: totalIncome } = useIncomeData();

  const [editing, setEditing] = useState<FixedCostLineItem | null>(null);

  const items = spendingPlan?.fixedCostLineItems ?? [];
  const totalFixedCosts = items.reduce((sum, i) => sum + i.monthlyAmount, 0);
  const derivedPercent =
    totalIncome > 0 ? Math.round((totalFixedCosts / totalIncome) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <motion.h1
        className="font-serif text-3xl text-text-primary mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Fixed Costs
      </motion.h1>
      <p className="text-text-secondary font-sans text-sm mb-8">
        The monthly bills that are locked in. They power the Fixed Costs
        bucket of your Conscious Spending Plan.
      </p>

      <div className="space-y-8">
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
      </div>
    </div>
  );
}
