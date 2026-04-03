"use client";

import { useRouter } from "next/navigation";
import { useFlowStore } from "@/lib/store/flow-store";
import { MONEY_SCRIPTS } from "@/lib/constants/money-scripts";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { ScriptPrompt } from "@/components/flow/ScriptPrompt";

export default function ScriptsPage() {
  const router = useRouter();
  const scripts = useFlowStore((s) => s.scripts);
  const setScript = useFlowStore((s) => s.setScript);
  const setCurrentStep = useFlowStore((s) => s.setCurrentStep);

  const filledCount = MONEY_SCRIPTS.filter(
    (s) => scripts[s.id]?.trim().length > 0
  ).length;
  const canContinue = filledCount >= 3;

  const handleNext = () => {
    setCurrentStep(1);
    router.push("/flow/money-type");
  };

  return (
    <StepWrapper
      title="Let's start with what money means to you."
      subtitle="There are no wrong answers. This is just for you."
    >
      <div className="space-y-2">
        {MONEY_SCRIPTS.map((script) => (
          <ScriptPrompt
            key={script.id}
            id={script.id}
            prompt={script.prompt}
            placeholder={script.placeholder}
            value={scripts[script.id] ?? ""}
            onChange={(value) => setScript(script.id, value)}
          />
        ))}
      </div>

      <p className="text-text-secondary text-sm mt-4 text-center font-sans">
        {filledCount} of {MONEY_SCRIPTS.length} answered
        {filledCount < 3 && " (at least 3 required)"}
      </p>

      <FlowNavigation
        onNext={handleNext}
        nextDisabled={!canContinue}
        showBack={false}
      />
    </StepWrapper>
  );
}
