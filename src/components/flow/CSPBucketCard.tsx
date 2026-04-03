"use client";

import { formatCurrency, formatPercent } from "@/lib/utils/format";

interface CSPBucketCardProps {
  label: string;
  percent: number;
  amount: number;
  color: string;
  description: string;
}

export function CSPBucketCard({
  label,
  percent,
  amount,
  color,
  description,
}: CSPBucketCardProps) {
  return (
    <div
      className="rounded-lg bg-white border border-bg-secondary p-4"
      style={{ borderLeftWidth: "4px", borderLeftColor: `var(--${color})` }}
    >
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-serif text-text-primary text-base">{label}</h3>
        <span className="text-2xl font-semibold text-text-primary">
          {formatPercent(percent)}
        </span>
      </div>
      <p className="text-lg font-semibold text-text-primary mb-1">
        {formatCurrency(amount)}
        <span className="text-sm font-normal text-text-secondary">/mo</span>
      </p>
      <p className="text-sm text-text-secondary">{description}</p>
    </div>
  );
}
