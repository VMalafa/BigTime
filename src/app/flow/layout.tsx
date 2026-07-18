"use client";

import { type ReactNode } from "react";
import { useFlowStore } from "@/lib/store/flow-store";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { FLOW_STEPS } from "@/types/flow";

// No hydrate-or-flush machinery left (#53): each flow page's hooks fetch
// their own entities from server truth and mutate through awaited
// per-intent actions.
export default function FlowLayout({ children }: { children: ReactNode }) {
  const currentStep = useFlowStore((s) => s.currentStep);

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-sm border-b border-bg-secondary px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <ProgressBar
            totalSteps={FLOW_STEPS.length}
            currentStep={currentStep + 1}
            labels={FLOW_STEPS.map((s) => s.label)}
          />
        </div>
      </div>
      {children}
    </div>
  );
}
