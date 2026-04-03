"use client";

import { type ReactNode } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { usePartnerStore } from "@/lib/store/partner-store";
import { COUPLES_STEPS } from "@/types/partner";

interface OnboardingLayoutProps {
  children: ReactNode;
}

export default function PartnerOnboardingLayout({
  children,
}: OnboardingLayoutProps) {
  const onboardingStep = usePartnerStore((s) => s.onboardingStep);

  const stepLabels = COUPLES_STEPS.map((s) => s.label);

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-sm border-b border-bg-secondary px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <ProgressBar
            totalSteps={COUPLES_STEPS.length}
            currentStep={onboardingStep + 1}
            labels={stepLabels}
          />
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-8">{children}</div>
    </div>
  );
}
