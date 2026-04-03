"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFlowStore } from "@/lib/store/flow-store";
import { FLOW_STEPS } from "@/types/flow";

export default function FlowPage() {
  const router = useRouter();
  const currentStep = useFlowStore((s) => s.currentStep);

  useEffect(() => {
    const step = FLOW_STEPS[currentStep];
    if (step) {
      router.replace(step.path);
    }
  }, [currentStep, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
        <p className="font-sans text-text-secondary text-sm">
          Loading your journey...
        </p>
      </div>
    </div>
  );
}
