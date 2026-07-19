"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useReflection } from "@/lib/hooks/useReflection";
import { saveMoneyScript } from "@/app/actions/reflection";
import { MONEY_SCRIPTS } from "@/lib/constants/money-scripts";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { ScriptPrompt } from "@/components/flow/ScriptPrompt";

export default function ScriptsPage() {
  const router = useRouter();
  const { scripts, setScriptLocal: setScript } = useReflection();
  const [saveError, setSaveError] = useState<string | null>(null);

  // Server-authoritative (#52): keystrokes stay local; the per-intent save
  // fires when an answer settles (blur). The text is never rolled back on
  // failure — the next blur retries; honesty over destruction.
  async function persistScript(promptId: number, value: string) {
    const result = await saveMoneyScript(promptId, value);
    setSaveError(
      result.error ? "An answer couldn't be saved — it will retry." : null
    );
  }

  const filledCount = MONEY_SCRIPTS.filter(
    (s) => scripts[s.id]?.trim().length > 0
  ).length;
  const canContinue = filledCount >= 3;

  const handleNext = () => {
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
            onBlur={(value) => void persistScript(script.id, value)}
          />
        ))}
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-red-600 font-sans mt-3 text-center">
          {saveError}
        </p>
      )}

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
