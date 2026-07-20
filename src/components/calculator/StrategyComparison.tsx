"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatMonths } from "@/lib/utils/format";

interface StrategyResult {
  totalInterestPaid: number;
  totalMonths: number;
  payoffDate: string;
  utilizationMilestones?: Array<{
    debtName: string;
    threshold: number;
    month: number;
  }>;
}

interface StrategyComparisonProps {
  results: {
    avalanche: StrategyResult;
    snowball: StrategyResult;
    utilization: StrategyResult;
  } | null;
  selectedStrategy: string;
  onSelectStrategy: (strategy: string) => void;
}

const STRATEGY_META: Record<
  string,
  { name: string; description: string; highlight: string }
> = {
  avalanche: {
    name: "Avalanche",
    description: "Pay highest interest rate first",
    highlight: "Saves the most money",
  },
  snowball: {
    name: "Snowball",
    description: "Pay smallest balance first",
    highlight: "Quick wins for motivation",
  },
  utilization: {
    name: "Utilization",
    description: "Optimize credit utilization first",
    highlight: "Boosts credit score fastest",
  },
};

export function StrategyComparison({
  results,
  selectedStrategy,
  onSelectStrategy,
}: StrategyComparisonProps) {
  if (!results) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <p>Add debts above to compare payoff strategies.</p>
      </div>
    );
  }

  const strategies = ["avalanche", "snowball", "utilization"] as const;

  const lowestInterest = Math.min(
    results.avalanche.totalInterestPaid,
    results.snowball.totalInterestPaid,
    results.utilization.totalInterestPaid
  );
  const fastestMonths = Math.min(
    results.avalanche.totalMonths,
    results.snowball.totalMonths,
    results.utilization.totalMonths
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {strategies.map((key) => {
        const strategy = results[key];
        const meta = STRATEGY_META[key];
        const isSelected = selectedStrategy === key;
        const isBestInterest = strategy.totalInterestPaid === lowestInterest;
        const isFastest = strategy.totalMonths === fastestMonths;

        return (
          <motion.div
            key={key}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className={`cursor-pointer transition-all duration-200 ${
                isSelected
                  ? "ring-2 ring-accent-gold border-accent-gold"
                  : "hover:border-accent-gold/50"
              }`}
              onClick={() => onSelectStrategy(key)}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-lg text-text-primary">
                    {meta.name}
                  </h3>
                  <div className="flex gap-1">
                    {isBestInterest && (
                      <span className="text-xs bg-cat-green/10 text-cat-green px-2 py-0.5 rounded-full font-medium">
                        Lowest Cost
                      </span>
                    )}
                    {isFastest && (
                      <span className="text-xs bg-cat-blue/10 text-cat-blue px-2 py-0.5 rounded-full font-medium">
                        Fastest
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-text-secondary">{meta.description}</p>

                <div className="flex flex-col gap-2 pt-2 border-t border-bg-secondary">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">
                      Total Interest
                    </span>
                    <span className="text-sm font-semibold text-text-primary">
                      {formatCurrency(strategy.totalInterestPaid)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">
                      Time to Payoff
                    </span>
                    <span className="text-sm font-semibold text-text-primary">
                      {formatMonths(strategy.totalMonths)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">
                      Payoff Date
                    </span>
                    <span className="text-sm font-semibold text-text-primary">
                      {strategy.payoffDate}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-accent-gold-deep font-medium text-center pt-1">
                  {meta.highlight}
                </p>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
