"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatPercentExact } from "@/lib/utils/format";

interface CreditHealthCardProps {
  utilization: number;
  category: "optimal" | "good" | "acceptable" | "high";
  debtCount: number;
  revolvingCount: number;
}

const categoryConfig: Record<
  string,
  { label: string; variant: "green" | "default" | "terra" }
> = {
  optimal: { label: "Optimal", variant: "green" },
  good: { label: "Good", variant: "green" },
  acceptable: { label: "Acceptable", variant: "default" },
  high: { label: "High", variant: "terra" },
};

export function CreditHealthCard({
  utilization,
  category,
  debtCount,
  revolvingCount,
}: CreditHealthCardProps) {
  if (revolvingCount === 0) {
    return (
      <Card padding="md">
        <p className="text-text-secondary text-sm">
          No revolving debt — credit utilization not applicable
        </p>
        {debtCount > 0 && (
          <p className="text-text-secondary text-xs mt-2">
            You have {debtCount} installment debt{debtCount !== 1 ? "s" : ""} tracked.
          </p>
        )}
      </Card>
    );
  }

  const config = categoryConfig[category];

  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <span className="font-serif text-3xl text-text-primary">
          {formatPercentExact(utilization)}
        </span>
        <div className="flex flex-col gap-1">
          <Badge variant={config.variant}>{config.label}</Badge>
          <span className="text-text-secondary text-xs">
            aggregate utilization
          </span>
        </div>
      </div>
      <p className="text-text-secondary text-xs mt-3">
        {revolvingCount} revolving account{revolvingCount !== 1 ? "s" : ""} out
        of {debtCount} total debt{debtCount !== 1 ? "s" : ""}
      </p>
    </Card>
  );
}
