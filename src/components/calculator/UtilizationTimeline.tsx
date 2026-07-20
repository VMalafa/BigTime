"use client";

import { motion } from "framer-motion";

interface Milestone {
  debtName: string;
  threshold: number;
  month: number;
}

interface UtilizationTimelineProps {
  milestones: Milestone[];
}

const THRESHOLD_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  30: { bg: "bg-warning/10", text: "text-warning", border: "border-warning" },
  10: { bg: "bg-cat-blue/10", text: "text-cat-blue", border: "border-cat-blue" },
  7: { bg: "bg-cat-green/10", text: "text-cat-green", border: "border-cat-green" },
};

function getThresholdStyle(threshold: number) {
  return (
    THRESHOLD_COLORS[threshold] ?? {
      bg: "bg-accent-gold/10",
      text: "text-accent-gold-deep",
      border: "border-accent-gold",
    }
  );
}

export function UtilizationTimeline({ milestones }: UtilizationTimelineProps) {
  if (!milestones || milestones.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary text-sm">
        No revolving debts to track.
      </div>
    );
  }

  const sorted = [...milestones].sort((a, b) => a.month - b.month);
  const maxMonth = sorted[sorted.length - 1]?.month ?? 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Horizontal timeline bar */}
      <div className="relative">
        <div className="w-full h-2 bg-bg-secondary rounded-full" />

        {sorted.map((milestone, index) => {
          const position = maxMonth > 0 ? (milestone.month / maxMonth) * 100 : 0;
          const style = getThresholdStyle(milestone.threshold);

          return (
            <motion.div
              key={`${milestone.debtName}-${milestone.threshold}-${index}`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${Math.min(Math.max(position, 2), 98)}%` }}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 ${style.border} ${style.bg} -ml-2`}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Milestone details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((milestone, index) => {
          const style = getThresholdStyle(milestone.threshold);

          return (
            <motion.div
              key={`${milestone.debtName}-${milestone.threshold}-detail-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
              className={`flex items-start gap-3 rounded-lg border ${style.border}/30 ${style.bg} px-4 py-3`}
            >
              <div
                className={`w-3 h-3 rounded-full border-2 ${style.border} shrink-0 mt-0.5`}
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-text-primary">
                  {milestone.debtName}
                </span>
                <span className={`text-xs font-semibold ${style.text}`}>
                  Below {milestone.threshold}% utilization
                </span>
                <span className="text-xs text-text-secondary">
                  Month {milestone.month}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
