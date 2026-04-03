"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  totalSteps: number;
  currentStep: number;
  labels?: string[];
  className?: string;
}

export function ProgressBar({
  totalSteps,
  currentStep,
  labels,
  className = "",
}: ProgressBarProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={totalSteps} aria-label={`Step ${currentStep} of ${totalSteps}`}>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepIndex = i + 1;
          const isCompleted = stepIndex < currentStep;
          const isCurrent = stepIndex === currentStep;

          return (
            <motion.div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                isCompleted
                  ? "bg-accent-gold"
                  : isCurrent
                    ? "bg-accent-gold"
                    : "bg-bg-secondary"
              }`}
              initial={false}
              animate={{
                scale: isCurrent ? 1 : 1,
                opacity: isCompleted || isCurrent ? 1 : 0.5,
              }}
              transition={{ duration: 0.3 }}
            >
              {isCurrent && (
                <motion.div
                  className="h-full rounded-full bg-accent-gold"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              )}
            </motion.div>
          );
        })}
      </div>
      {labels && labels.length > 0 && (
        <div className="flex items-center gap-1.5">
          {labels.map((label, i) => {
            const stepIndex = i + 1;
            const isCurrent = stepIndex === currentStep;
            const isCompleted = stepIndex < currentStep;

            return (
              <span
                key={i}
                className={`flex-1 text-center text-xs font-sans transition-colors duration-300 ${
                  isCurrent
                    ? "text-accent-gold font-semibold"
                    : isCompleted
                      ? "text-text-primary"
                      : "text-text-secondary/50"
                }`}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
