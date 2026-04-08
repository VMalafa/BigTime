"use client";

import { Card } from "@/components/ui/Card";
import { CSP_RANGES, CSP_BUCKET_COLORS, type CSPBucket } from "@/lib/constants/csp-ranges";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import type { SpendingPlanData } from "@/lib/store/flow-store";

interface CSPOverviewProps {
  plan: SpendingPlanData;
  totalIncome: number;
}

type SpendingPlanPercentKey = {
  [K in keyof SpendingPlanData]: SpendingPlanData[K] extends number ? K : never;
}[keyof SpendingPlanData];

const bucketKeys: { key: CSPBucket; planKey: SpendingPlanPercentKey }[] = [
  { key: "fixedCosts", planKey: "fixedCostsPercent" },
  { key: "savings", planKey: "savingsPercent" },
  { key: "investments", planKey: "investmentsPercent" },
  { key: "guiltFree", planKey: "guiltFreePercent" },
];

const colorMap: Record<string, string> = {
  "cat-blue": "border-l-cat-blue",
  "cat-green": "border-l-cat-green",
  "cat-plum": "border-l-cat-plum",
  "accent-gold": "border-l-accent-gold",
};

export function CSPOverview({ plan, totalIncome }: CSPOverviewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {bucketKeys.map(({ key, planKey }) => {
        const range = CSP_RANGES[key];
        const colorToken = CSP_BUCKET_COLORS[key];
        const percent = plan[planKey];
        const amount = (percent / 100) * totalIncome;

        return (
          <Card
            key={key}
            padding="md"
            className={`border-l-4 ${colorMap[colorToken] ?? "border-l-accent-gold"}`}
          >
            <p className="text-sm text-text-secondary font-sans">
              {range.label}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-serif text-2xl text-text-primary">
                {formatPercent(percent)}
              </span>
              <span className="text-text-secondary text-sm">
                {formatCurrency(amount)}/mo
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              {range.description}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
