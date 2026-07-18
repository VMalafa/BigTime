"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFlowStore } from "@/lib/store/flow-store";
import { saveMoneyDial } from "@/app/actions/reflection";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { MoneyDialsGrid } from "@/components/flow/MoneyDialsGrid";
import type { DialCategory } from "@/lib/store/flow-store";

// Per-dial save debounce: a slider drag emits many changes; the intent is
// "set this dial", awaited once the hand settles.
const DIAL_SAVE_DEBOUNCE_MS = 400;

export default function MoneyDialsPage() {
  const router = useRouter();
  const moneyDials = useFlowStore((s) => s.moneyDials);
  const setMoneyDial = useFlowStore((s) => s.setMoneyDial);
  const setCurrentStep = useFlowStore((s) => s.setCurrentStep);
  const setComplete = useFlowStore((s) => s.setComplete);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timersRef = useRef(new Map<DialCategory, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const handleNext = () => {
    setCurrentStep(6);
    setComplete(true);
    router.push("/flow/summary");
  };

  const handleBack = () => {
    setCurrentStep(3);
    router.push("/flow/spending-plan");
  };

  // Server-authoritative (#52): the slider updates locally at drag speed;
  // each dial's awaited per-intent save fires when the hand settles, with
  // rollback to the last saved value on failure.
  const handleDialChange = (category: DialCategory, level: number) => {
    const previous = useFlowStore.getState().moneyDials[category];
    setMoneyDial(category, level);

    const timers = timersRef.current;
    const pending = timers.get(category);
    if (pending) clearTimeout(pending);
    timers.set(
      category,
      setTimeout(async () => {
        timers.delete(category);
        const latest = useFlowStore.getState().moneyDials[category];
        const result = await saveMoneyDial(category, latest);
        if (result.error) {
          useFlowStore.getState().setMoneyDial(category, previous);
          setSaveError(result.error);
        } else {
          setSaveError(null);
        }
      }, DIAL_SAVE_DEBOUNCE_MS)
    );
  };

  return (
    <StepWrapper
      title="Turn up what you love"
      subtitle="Cut mercilessly on what you don't care about, spend extravagantly on what you love."
    >
      <MoneyDialsGrid values={moneyDials} onChange={handleDialChange} />

      {saveError && (
        <p role="alert" className="text-sm text-red-600 font-sans mt-3 text-center">
          {saveError}
        </p>
      )}

      <FlowNavigation
        onBack={handleBack}
        onNext={handleNext}
        nextLabel="See My Plan"
      />
    </StepWrapper>
  );
}
