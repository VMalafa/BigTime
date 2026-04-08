"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { IncomeEntryForm } from "@/components/flow/IncomeEntryForm";
import { BonusEntryForm } from "@/components/flow/BonusEntryForm";
import { useFlowStore } from "@/lib/store/flow-store";
import { formatCurrency } from "@/lib/utils/format";

export default function IncomePage() {
  const router = useRouter();
  const incomeSources = useFlowStore((s) => s.incomeSources);
  const bonusItems = useFlowStore((s) => s.bonusItems);
  const setCurrentStep = useFlowStore((s) => s.setCurrentStep);
  const monthlyIncome = useFlowStore((s) => s.getTotalMonthlyIncome());
  const monthlyBonus = useFlowStore((s) => s.getMonthlyBonusEquivalent());
  const effectiveMonthly = monthlyIncome + monthlyBonus;

  const [showBonus, setShowBonus] = useState(bonusItems.length > 0);

  function handleNext() {
    setCurrentStep(3);
    router.push("/flow/fixed-costs");
  }

  function handleBack() {
    router.push("/flow/debts");
  }

  return (
    <StepWrapper
      title="Your income"
      subtitle="This powers your spending plan. Include regular pay — and bonuses if you get them."
    >
      <div className="space-y-8">
        <IncomeEntryForm />

        <div className="pt-2 border-t border-bg-secondary">
          <button
            type="button"
            onClick={() => setShowBonus((v) => !v)}
            className="flex items-center justify-between w-full text-left group"
          >
            <div>
              <h3 className="font-serif text-lg text-text-primary">
                Bonuses &amp; incentives
                <span className="ml-2 text-sm font-sans text-text-secondary">
                  (optional)
                </span>
              </h3>
              <p className="text-xs text-text-secondary font-sans">
                Performance bonuses, profit share, commissions.
              </p>
            </div>
            <span className="text-accent-gold text-sm font-sans font-medium group-hover:underline">
              {showBonus ? "Hide" : "Add bonus"}
            </span>
          </button>
          <AnimatePresence>
            {showBonus && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="pt-4">
                  <BonusEntryForm />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {(incomeSources.length > 0 || bonusItems.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-bg-secondary p-5 space-y-2"
          >
            <div className="flex justify-between items-center text-sm font-sans">
              <span className="text-text-secondary">Regular income</span>
              <span className="text-text-primary">
                {formatCurrency(monthlyIncome)}/mo
              </span>
            </div>
            {bonusItems.length > 0 && (
              <div className="flex justify-between items-center text-sm font-sans">
                <span className="text-text-secondary">
                  Bonus avg. (net)
                </span>
                <span className="text-text-primary">
                  {formatCurrency(monthlyBonus)}/mo
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-white/50">
              <span className="text-text-secondary">Effective monthly</span>
              <span className="text-2xl font-semibold text-accent-gold">
                {formatCurrency(effectiveMonthly)}/mo
              </span>
            </div>
          </motion.div>
        )}

        <FlowNavigation
          onBack={handleBack}
          onNext={handleNext}
          nextLabel="Continue"
          nextDisabled={incomeSources.length === 0}
          showBack
        />
      </div>
    </StepWrapper>
  );
}
