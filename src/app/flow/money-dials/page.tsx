"use client";

import { useRouter } from "next/navigation";
import { useFlowStore } from "@/lib/store/flow-store";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { MoneyDialsGrid } from "@/components/flow/MoneyDialsGrid";
import type { DialCategory } from "@/lib/store/flow-store";

export default function MoneyDialsPage() {
  const router = useRouter();
  const moneyDials = useFlowStore((s) => s.moneyDials);
  const setMoneyDial = useFlowStore((s) => s.setMoneyDial);
  const setCurrentStep = useFlowStore((s) => s.setCurrentStep);
  const setComplete = useFlowStore((s) => s.setComplete);

  const handleNext = () => {
    setCurrentStep(6);
    setComplete(true);
    router.push("/flow/summary");
  };

  const handleBack = () => {
    setCurrentStep(3);
    router.push("/flow/spending-plan");
  };

  const handleDialChange = (category: DialCategory, level: number) => {
    setMoneyDial(category, level);
  };

  return (
    <StepWrapper
      title="Turn up what you love"
      subtitle="Cut mercilessly on what you don't care about, spend extravagantly on what you love."
    >
      <MoneyDialsGrid values={moneyDials} onChange={handleDialChange} />

      <FlowNavigation
        onBack={handleBack}
        onNext={handleNext}
        nextLabel="See My Plan"
      />
    </StepWrapper>
  );
}
