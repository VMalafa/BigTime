"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFlowStore } from "@/lib/store/flow-store";
import { useReflection } from "@/lib/hooks/useReflection";
import { saveMoneyType } from "@/app/actions/reflection";
import { MONEY_TYPES, type MoneyTypeKey } from "@/lib/constants/money-types";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { MoneyTypeCard } from "@/components/flow/MoneyTypeCard";
import type { MoneyType } from "@/lib/store/flow-store";

export default function MoneyTypePage() {
  const router = useRouter();
  const { moneyType, setMoneyTypeLocal } = useReflection();
  const setCurrentStep = useFlowStore((s) => s.setCurrentStep);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Server-authoritative (#52): selection is an awaited per-intent action
  // with optimistic UI + rollback.
  async function handleSelect(key: MoneyType) {
    setSaveError(null);
    const previous = moneyType;
    setMoneyTypeLocal(key);
    const result = await saveMoneyType(key);
    if (result.error) {
      setMoneyTypeLocal(previous);
      setSaveError(result.error);
    }
  }

  const handleNext = () => {
    setCurrentStep(2);
    // Onboarding fork: link accounts (the feed drafts Proposals) or type it
    // in (the unchanged manual path).
    router.push("/flow/link-accounts");
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
            onSelect={() => void handleSelect(key as MoneyType)}
          />
        ))}
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-red-600 font-sans mt-3 text-center">
          {saveError}
        </p>
      )}

      <FlowNavigation
        onBack={handleBack}
        onNext={handleNext}
        nextDisabled={moneyType === null}
      />
    </StepWrapper>
  );
}
