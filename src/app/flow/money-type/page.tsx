"use client";

import { useRouter } from "next/navigation";
import { useFlowStore } from "@/lib/store/flow-store";
import { MONEY_TYPES, type MoneyTypeKey } from "@/lib/constants/money-types";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { MoneyTypeCard } from "@/components/flow/MoneyTypeCard";
import type { MoneyType } from "@/lib/store/flow-store";

export default function MoneyTypePage() {
  const router = useRouter();
  const moneyType = useFlowStore((s) => s.moneyType);
  const setMoneyType = useFlowStore((s) => s.setMoneyType);
  const setCurrentStep = useFlowStore((s) => s.setCurrentStep);

  const handleNext = () => {
    setCurrentStep(2);
    router.push("/flow/debts");
  };

  const handleBack = () => {
    setCurrentStep(0);
    router.push("/flow/scripts");
  };

  return (
    <StepWrapper
      title="What's your Money Type?"
      subtitle="Pick the one that feels most like you — even if it's not perfect."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(MONEY_TYPES) as MoneyTypeKey[]).map((key) => (
          <MoneyTypeCard
            key={key}
            type={key}
            data={MONEY_TYPES[key]}
            isSelected={moneyType === key}
            onSelect={() => setMoneyType(key as MoneyType)}
          />
        ))}
      </div>

      <FlowNavigation
        onBack={handleBack}
        onNext={handleNext}
        nextDisabled={moneyType === null}
      />
    </StepWrapper>
  );
}
