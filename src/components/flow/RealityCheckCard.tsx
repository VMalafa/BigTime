"use client";

import { motion } from "framer-motion";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import {
  FIXED_COSTS_RECOMMENDED_MIN,
  FIXED_COSTS_RECOMMENDED_MAX,
} from "@/lib/constants/csp-ranges";

interface RealityCheckCardProps {
  totalIncome: number;
  totalFixedCosts: number;
  derivedPercent: number;
  lineItemsTotal?: number;
  debtMinimumsTotal?: number;
}

type BandStatus = "on-target" | "high" | "low" | "no-income";

function bandStatus(
  derivedPercent: number,
  totalIncome: number
): BandStatus {
  if (totalIncome <= 0) return "no-income";
  if (derivedPercent > FIXED_COSTS_RECOMMENDED_MAX) return "high";
  if (derivedPercent < FIXED_COSTS_RECOMMENDED_MIN) return "low";
  return "on-target";
}

const BAND_COPY: Record<BandStatus, { label: string; body: string; tone: "green" | "amber" | "neutral" }> = {
  "on-target": {
    label: `On target (${FIXED_COSTS_RECOMMENDED_MIN}–${FIXED_COSTS_RECOMMENDED_MAX}%)`,
    body: "Your fixed costs sit inside Ramit's recommended band. Nice.",
    tone: "green",
  },
  high: {
    label: `High fixed costs (above ${FIXED_COSTS_RECOMMENDED_MAX}%)`,
    body: "Review the largest line items — rent, car, insurance — to see if anything can be trimmed or renegotiated.",
    tone: "amber",
  },
  low: {
    label: `Low fixed costs (below ${FIXED_COSTS_RECOMMENDED_MIN}%)`,
    body: "Double-check you've listed every recurring obligation. Anything missing makes the rest of the plan unreliable.",
    tone: "neutral",
  },
  "no-income": {
    label: "Add income to see a %",
    body: "We compute your Fixed Costs percentage from your total monthly income. Go back to the income step to add a source.",
    tone: "neutral",
  },
};

export function RealityCheckCard({
  totalIncome,
  totalFixedCosts,
  derivedPercent,
  lineItemsTotal,
  debtMinimumsTotal,
}: RealityCheckCardProps) {
  const remaining = totalIncome - totalFixedCosts;
  const status = bandStatus(derivedPercent, totalIncome);
  const copy = BAND_COPY[status];
  // Show the breakdown row only when both parts are known AND debt minimums
  // actually contribute something, so the card stays compact for users with
  // no debt.
  const showBreakdown =
    lineItemsTotal !== undefined &&
    debtMinimumsTotal !== undefined &&
    debtMinimumsTotal > 0;

  const toneClasses: Record<typeof copy.tone, { border: string; bg: string; text: string }> = {
    green: {
      border: "border-cat-green",
      bg: "bg-cat-green/10",
      text: "text-cat-green",
    },
    amber: {
      border: "border-warning",
      bg: "bg-warning/10",
      text: "text-warning",
    },
    neutral: {
      border: "border-bg-secondary",
      bg: "bg-bg-secondary",
      text: "text-text-secondary",
    },
  };

  const tone = toneClasses[copy.tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg bg-white border border-bg-secondary p-5 space-y-4"
    >
      <div>
        <h3 className="font-serif text-lg text-text-primary mb-1">
          Reality Check
        </h3>
        <p className="text-sm text-text-secondary">
          Here&apos;s what&apos;s actually locked in each month.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <p className="text-text-secondary">Total monthly income</p>
          <p className="text-lg font-semibold text-text-primary">
            {formatCurrency(totalIncome)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-text-secondary">Total fixed commitments</p>
          <p className="text-lg font-semibold text-text-primary">
            {formatCurrency(totalFixedCosts)}
          </p>
          {showBreakdown && (
            <p className="text-xs text-text-secondary">
              {formatCurrency(lineItemsTotal ?? 0)} line items +{" "}
              {formatCurrency(debtMinimumsTotal ?? 0)} debt minimums
            </p>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-text-secondary">Remaining discretionary</p>
          <p
            className={`text-lg font-semibold ${
              remaining < 0 ? "text-error" : "text-cat-green"
            }`}
          >
            {formatCurrency(remaining)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-text-secondary">Derived Fixed Costs %</p>
          <p className="text-lg font-semibold text-text-primary">
            {totalIncome > 0 ? formatPercent(derivedPercent) : "—"}
          </p>
        </div>
      </div>

      <div
        className={`rounded-md border px-4 py-3 ${tone.border} ${tone.bg}`}
      >
        <p className={`text-sm font-medium ${tone.text}`}>{copy.label}</p>
        <p className="text-sm text-text-secondary mt-1">{copy.body}</p>
      </div>
    </motion.div>
  );
}
