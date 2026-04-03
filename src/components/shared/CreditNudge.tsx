"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { CREDIT_TIPS, type CreditTip } from "@/lib/constants/credit-tips";

interface CreditNudgeProps {
  utilization: number | null;
  automationCoverage: number;
  hasRevolvingDebt: boolean;
  recentMilestone: "30" | "10" | "7" | null;
}

function selectTip({
  utilization,
  automationCoverage,
  hasRevolvingDebt,
  recentMilestone,
}: CreditNudgeProps): CreditTip {
  const findTip = (condition: CreditTip["condition"]): CreditTip | undefined =>
    CREDIT_TIPS.find((t) => t.condition === condition);

  if (recentMilestone) {
    const milestoneTip = findTip(`milestone_${recentMilestone}` as CreditTip["condition"]);
    if (milestoneTip) return milestoneTip;
  }

  if (utilization !== null && utilization >= 30) {
    const tip = findTip("high_utilization");
    if (tip) return tip;
  }

  if (utilization !== null && utilization >= 10 && utilization < 30) {
    const tip = findTip("moderate_utilization");
    if (tip) return tip;
  }

  if (automationCoverage < 0.5) {
    const tip = findTip("low_automation");
    if (tip) return tip;
  }

  if (!hasRevolvingDebt) {
    const tip = findTip("no_revolving");
    if (tip) return tip;
  }

  const generalTips = CREDIT_TIPS.filter((t) => t.condition === "general");
  return generalTips[Math.floor(Math.random() * generalTips.length)] ?? CREDIT_TIPS[0];
}

export function CreditNudge(props: CreditNudgeProps) {
  const [visible, setVisible] = useState(true);
  const tip = selectTip(props);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Card
            padding="none"
            className="border-l-4 border-l-accent-gold overflow-hidden"
          >
            <div className="flex items-start gap-3 p-4">
              <span className="text-xl shrink-0 mt-0.5" role="img" aria-label="Tip">
                💡
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-secondary font-sans leading-relaxed">
                  {tip.message}
                </p>
              </div>
              <button
                onClick={() => setVisible(false)}
                className="shrink-0 text-text-secondary/50 hover:text-text-secondary transition-colors p-1 -mt-1 -mr-1"
                aria-label="Dismiss tip"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 4L12 12M12 4L4 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
