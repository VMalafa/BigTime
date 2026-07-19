"use client";

// The income surface. The standalone bonus ledger is retired (#89): a
// bonus is a Bonus Moment now — detected from the feed, or recorded here
// when the feed missed it — and never smoothed into monthly income, so
// the plan runs on real paychecks only (windfalls never inflate
// Safe-to-Spend). Pre-#89 BonusItem rows surface once for migration.

import { motion } from "framer-motion";
import Link from "next/link";
import { useIncomeData } from "@/lib/hooks/useIncomeData";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IncomeEntryForm } from "@/components/flow/IncomeEntryForm";
import { BonusFallback } from "@/components/dashboard/BonusFallback";
import { IncomeProposalsPanel } from "@/components/proposals/IncomeProposalsPanel";
import { formatCurrency } from "@/lib/utils/format";

export default function IncomeDashboardPage() {
  const { incomeSources, totalMonthlyIncome: monthlyIncome } = useIncomeData();
  const incomeCount = incomeSources.length;

  return (
    <div>
      <motion.h1
        className="font-serif text-3xl text-text-primary mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Income Planning
      </motion.h1>
      <p className="text-text-secondary font-sans text-sm mb-6">
        Track regular income here. Windfalls arrive as one-confirm Bonus
        Moments — split by your Bonus Plan, never counted as spending room.
      </p>

      {/* Summary strip: real repeating income only — bonus money is a
          Moment, not a monthly average. */}
      <Card padding="lg" className="mb-8 border-l-4 border-l-accent-gold">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-secondary font-sans">
              Regular monthly
            </p>
            <p className="font-serif text-2xl text-text-primary mt-1">
              {formatCurrency(monthlyIncome)}
            </p>
            <p className="text-xs text-text-secondary font-sans mt-0.5">
              {incomeCount} source{incomeCount !== 1 ? "s" : ""} · drives your
              spending plan
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary font-sans">Windfalls</p>
            <p className="font-sans text-sm text-text-primary mt-2">
              Decided one Moment at a time, on your standing split.
            </p>
            <Link
              href="/dashboard/spending-plan"
              className="text-xs font-sans text-accent-gold hover:underline mt-0.5 inline-block"
            >
              Review the Bonus Plan →
            </Link>
          </div>
        </div>
      </Card>

      {/* Income Proposals from linked accounts — always individually
          confirmed; income moves every CSP percentage. */}
      <div className="mb-8">
        <IncomeProposalsPanel />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="font-serif text-xl text-text-primary mb-1">
            Regular Income
          </h2>
          <p className="text-text-secondary text-sm font-sans mb-4">
            Paychecks, recurring freelance, rental income — anything that
            repeats every month.
          </p>
          <IncomeEntryForm />
        </section>

        <section>
          <h2 className="font-serif text-xl text-text-primary mb-1">
            Bonuses &amp; Windfalls
          </h2>
          <p className="text-text-secondary text-sm font-sans mb-4">
            Linked accounts raise these on their own. If one landed somewhere
            the feed can&apos;t see, record it here — it becomes the same
            one-confirm Moment.
          </p>
          <BonusFallback />
        </section>
      </div>

      <div className="mt-10 flex items-center justify-between pt-6 border-t border-bg-secondary">
        <Link href="/dashboard">
          <Button variant="ghost" size="md">
            ← Back to dashboard
          </Button>
        </Link>
        <Link href="/dashboard/spending-plan">
          <Button variant="secondary" size="md">
            Review spending plan
          </Button>
        </Link>
      </div>
    </div>
  );
}
