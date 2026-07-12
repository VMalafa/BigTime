"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useFlowStore } from "@/lib/store/flow-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IncomeEntryForm } from "@/components/flow/IncomeEntryForm";
import { BonusEntryForm } from "@/components/flow/BonusEntryForm";
import { IncomeProposalsPanel } from "@/components/proposals/IncomeProposalsPanel";
import { formatCurrency } from "@/lib/utils/format";

export default function IncomeDashboardPage() {
  const monthlyIncome = useFlowStore((s) => s.getTotalMonthlyIncome());
  const monthlyBonus = useFlowStore((s) => s.getMonthlyBonusEquivalent());
  const annualBonus = useFlowStore((s) => s.getTotalAnnualBonusNet());
  const effectiveMonthly = useFlowStore((s) => s.getEffectiveMonthlyIncome());
  const bonusCount = useFlowStore((s) => s.bonusItems.length);
  const incomeCount = useFlowStore((s) => s.incomeSources.length);

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
        Track regular income and large bonus payouts. Bonuses get smoothed into
        a monthly equivalent so your plan stays realistic.
      </p>

      {/* Summary strip */}
      <Card padding="lg" className="mb-8 border-l-4 border-l-accent-gold">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-text-secondary font-sans">
              Regular monthly
            </p>
            <p className="font-serif text-2xl text-text-primary mt-1">
              {formatCurrency(monthlyIncome)}
            </p>
            <p className="text-xs text-text-secondary font-sans mt-0.5">
              {incomeCount} source{incomeCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary font-sans">
              Bonus monthly avg. (net)
            </p>
            <p className="font-serif text-2xl text-text-primary mt-1">
              {formatCurrency(monthlyBonus)}
            </p>
            <p className="text-xs text-text-secondary font-sans mt-0.5">
              {bonusCount} bonus{bonusCount !== 1 ? "es" : ""} ·{" "}
              {formatCurrency(annualBonus)}/yr net
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary font-sans">
              Effective monthly
            </p>
            <p className="font-serif text-2xl text-accent-gold mt-1">
              {formatCurrency(effectiveMonthly)}
            </p>
            <p className="text-xs text-text-secondary font-sans mt-0.5">
              Drives your spending plan
            </p>
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
            Bonuses &amp; Incentives
          </h2>
          <p className="text-text-secondary text-sm font-sans mb-4">
            Performance bonuses, profit share, sales commissions. Enter the
            gross amount — we&apos;ll estimate net after taxes.
          </p>
          <BonusEntryForm />
        </section>
      </div>

      <div className="mt-10 flex items-center justify-between pt-6 border-t border-bg-secondary">
        <Link href="/dashboard">
          <Button variant="ghost" size="md">
            ← Back to dashboard
          </Button>
        </Link>
        <Link href="/flow/spending-plan">
          <Button variant="secondary" size="md">
            Review spending plan
          </Button>
        </Link>
      </div>
    </div>
  );
}
