"use client";

import { Slider } from "@/components/ui/Slider";
import { CSPBucketCard } from "@/components/flow/CSPBucketCard";
import { CSP_RANGES, CSP_BUCKET_COLORS, type CSPBucket } from "@/lib/constants/csp-ranges";
import { type SpendingPlanData } from "@/lib/store/flow-store";
import { formatCurrency, formatPercent } from "@/lib/utils/format";

const BUCKET_KEYS: { key: CSPBucket; field: keyof SpendingPlanData }[] = [
  { key: "fixedCosts", field: "fixedCostsPercent" },
  { key: "savings", field: "savingsPercent" },
  { key: "investments", field: "investmentsPercent" },
  { key: "guiltFree", field: "guiltFreePercent" },
];

interface CSPSlidersProps {
  values: SpendingPlanData;
  onChange: (updated: SpendingPlanData) => void;
  totalIncome: number;
}

export function CSPSliders({ values, onChange, totalIncome }: CSPSlidersProps) {
  const total =
    values.fixedCostsPercent +
    values.savingsPercent +
    values.investmentsPercent +
    values.guiltFreePercent;

  const remaining = 100 - total;
  const isOver = total > 100;

  function handleChange(field: keyof SpendingPlanData, value: number) {
    onChange({ ...values, [field]: value });
  }

  return (
    <div className="space-y-6">
      {BUCKET_KEYS.map(({ key, field }) => {
        const range = CSP_RANGES[key];
        const color = CSP_BUCKET_COLORS[key];
        const percent = values[field];
        const amount = (percent / 100) * totalIncome;

        return (
          <div key={key} className="space-y-2">
            <CSPBucketCard
              label={range.label}
              percent={percent}
              amount={amount}
              color={color}
              description={range.description}
            />
            <Slider
              min={0}
              max={100}
              step={1}
              value={percent}
              onChange={(v) => handleChange(field, v)}
              showValue={false}
              minLabel={`${range.min}% recommended`}
              maxLabel={`${range.max}% max rec.`}
            />
          </div>
        );
      })}

      {/* Total indicator */}
      <div
        className={`rounded-lg p-4 text-center font-sans ${
          isOver
            ? "bg-error/10 border border-error"
            : remaining === 0
            ? "bg-cat-green/10 border border-cat-green"
            : "bg-bg-secondary border border-bg-secondary"
        }`}
      >
        <p className="text-sm text-text-secondary mb-1">Total Allocated</p>
        <p
          className={`text-2xl font-semibold ${
            isOver
              ? "text-error"
              : remaining === 0
              ? "text-cat-green"
              : "text-text-primary"
          }`}
        >
          {formatPercent(total)}
        </p>
        {isOver && (
          <p className="text-sm text-error mt-1">
            Over by {formatPercent(total - 100)} ({formatCurrency(((total - 100) / 100) * totalIncome)})
          </p>
        )}
        {!isOver && remaining > 0 && (
          <p className="text-sm text-text-secondary mt-1">
            {formatPercent(remaining)} remaining ({formatCurrency((remaining / 100) * totalIncome)})
          </p>
        )}
        {remaining === 0 && !isOver && (
          <p className="text-sm text-cat-green mt-1">
            Every dollar is allocated
          </p>
        )}
      </div>
    </div>
  );
}
