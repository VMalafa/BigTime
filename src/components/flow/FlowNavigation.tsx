"use client";

import { Button } from "@/components/ui/Button";

interface FlowNavigationProps {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
}

export function FlowNavigation({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  showBack = true,
}: FlowNavigationProps) {
  return (
    <div className="flex items-center justify-between mt-10">
      {showBack && onBack ? (
        <Button variant="ghost" size="md" onClick={onBack}>
          Back
        </Button>
      ) : (
        <div />
      )}
      <Button
        variant="primary"
        size="lg"
        onClick={onNext}
        disabled={nextDisabled}
      >
        {nextLabel}
      </Button>
    </div>
  );
}
