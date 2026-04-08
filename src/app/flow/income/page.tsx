"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { IncomeEntryForm } from "@/components/flow/IncomeEntryForm";
import { useFlowStore } from "@/lib/store/flow-store";
import { formatCurrency } from "@/lib/utils/format";

export default function IncomePage() {
  const router = useRouter();
  const { incomeSources, setCurrentStep, getTotalMonthlyIncome } =
    useFlowStore();

  const totalIncome = getTotalMonthlyIncome();

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
      subtitle="This powers your spending plan. Include all regular income."
    >
      <div className="space-y-8">
        <IncomeEntryForm />

        {incomeSources.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-bg-secondary p-5"
          >
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Total Monthly Income</span>
              <span className="text-2xl font-semibold text-accent-gold">
                {formatCurrency(totalIncome)}/mo
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
