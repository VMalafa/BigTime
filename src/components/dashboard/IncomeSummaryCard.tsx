"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils/format";

interface UpcomingBonus {
  name: string;
  netAmount: number;
  expectedDate?: string;
}

interface IncomeSummaryCardProps {
  monthlyIncome: number;
  monthlyBonusEquivalent: number;
  annualBonusNet: number;
  bonusCount: number;
  nextBonus?: UpcomingBonus;
  hasIncomeSources: boolean;
}

function formatExpected(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function IncomeSummaryCard({
  monthlyIncome,
  monthlyBonusEquivalent,
  annualBonusNet,
  bonusCount,
  nextBonus,
  hasIncomeSources,
}: IncomeSummaryCardProps) {
  const effectiveMonthly = monthlyIncome + monthlyBonusEquivalent;
  const expectedLabel = formatExpected(nextBonus?.expectedDate);

  return (
    <Card padding="lg" className="border-l-4 border-l-accent-gold">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-serif text-lg text-text-primary">Monthly Income</h3>
        <Link
          href="/dashboard/income"
          className="text-accent-gold text-sm font-sans font-medium hover:underline"
        >
          Manage →
        </Link>
      </div>

      {!hasIncomeSources && bonusCount === 0 ? (
        <div>
          <p className="text-text-secondary text-sm font-sans">
            No income tracked yet.
          </p>
          <Link
            href="/dashboard/income"
            className="text-accent-gold text-sm font-sans mt-2 inline-block hover:underline"
          >
            Add your income
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-text-secondary text-xs font-sans">
              Effective monthly (regular + bonus avg.)
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-serif text-3xl text-text-primary">
                {formatCurrency(effectiveMonthly)}
              </span>
              <span className="text-text-secondary text-sm font-sans">/mo</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-bg-secondary">
            <div>
              <p className="text-text-secondary text-xs font-sans">
                Regular income
              </p>
              <p className="text-text-primary font-sans font-medium">
                {formatCurrency(monthlyIncome)}/mo
              </p>
            </div>
            <div>
              <p className="text-text-secondary text-xs font-sans">
                Bonus (net, monthly avg.)
              </p>
              <p className="text-text-primary font-sans font-medium">
                {formatCurrency(monthlyBonusEquivalent)}/mo
              </p>
            </div>
          </div>

          {bonusCount > 0 && (
            <div className="pt-2 border-t border-bg-secondary space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="green">
                  {bonusCount} bonus{bonusCount !== 1 ? "es" : ""} tracked
                </Badge>
                <span className="text-xs text-text-secondary font-sans">
                  {formatCurrency(annualBonusNet)}/yr net
                </span>
              </div>
              {nextBonus && (
                <div className="rounded-md bg-bg-secondary/60 p-3">
                  <p className="text-xs text-text-secondary font-sans">
                    Next expected
                  </p>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="text-sm font-sans text-text-primary">
                      {nextBonus.name}
                    </span>
                    <span className="text-sm font-sans font-semibold text-accent-gold">
                      {formatCurrency(nextBonus.netAmount)} net
                    </span>
                  </div>
                  {expectedLabel && (
                    <p className="text-xs text-text-secondary font-sans mt-0.5">
                      {expectedLabel}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
