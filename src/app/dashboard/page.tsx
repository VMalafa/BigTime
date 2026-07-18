"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/hooks/useAuth";
import type { SpendingPlanData } from "@/lib/store/flow-store";
import { getHouseholdFinancials } from "@/app/actions/household";
import { WholenessScoreRing } from "@/components/dashboard/WholenessScoreRing";
import { CSPOverview } from "@/components/dashboard/CSPOverview";
import { CreditHealthCard } from "@/components/dashboard/CreditHealthCard";
import { IncomeSummaryCard } from "@/components/dashboard/IncomeSummaryCard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { MonthlyCheckInPrompt } from "@/components/dashboard/MonthlyCheckInPrompt";
import { SafeToSpendCard } from "@/components/dashboard/SafeToSpendCard";
import { AddPartnerPrompt } from "@/components/shared/AddPartnerPrompt";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatMonths } from "@/lib/utils/format";
import { calculateBonusNet } from "@/lib/calculations/bonus-tax";
import Link from "next/link";

const defaultPlan = {
  fixedCostsPercent: 55,
  savingsPercent: 10,
  investmentsPercent: 10,
  guiltFreePercent: 25,
  fixedCostLineItems: [],
  fixedCostsOverridden: false,
};

interface HouseholdBonus {
  id: string;
  name: string;
  grossAmount: number;
  estimatedTaxRate: number;
  frequency: string;
  expectedDate?: string;
}

interface HouseholdData {
  profiles: Array<{ id: string; name: string; moneyType: string | null }>;
  spendingPlan: SpendingPlanData | null;
  totalDebt: number;
  totalMinPayments: number;
  totalMonthlyIncome: number;
  totalAnnualBonusNet: number;
  monthlyBonusEquivalent: number;
  effectiveMonthlyIncome: number;
  debtCount: number;
  debts: Array<{
    balance: number;
    debtType: string;
    creditLimit?: number;
  }>;
  bonuses: HouseholdBonus[];
  profileCount: number;
}

export default function DashboardPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [household, setHousehold] = useState<HouseholdData | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      getHouseholdFinancials().then((data) => setHousehold(data as HouseholdData | null));
    }
  }, [isAuthenticated, authLoading]);

  // Server data only (#53): the database is the single source; before the
  // fetch resolves the cards render their honest empty/default states.
  const debts = household?.debts ?? [];
  const totalDebt = household?.totalDebt ?? 0;
  const monthlyIncome = household?.totalMonthlyIncome ?? 0;
  const monthlyBonusEquivalent = household?.monthlyBonusEquivalent ?? 0;
  const annualBonusNet = household?.totalAnnualBonusNet ?? 0;
  const totalIncome = monthlyIncome + monthlyBonusEquivalent || 5000;
  const bonusCount = household?.bonuses?.length ?? 0;
  const hasIncomeSources = (household?.totalMonthlyIncome ?? 0) > 0;
  const plan = household?.spendingPlan ?? defaultPlan;

  // Pick the next upcoming bonus — sort by expected date ascending so the
  // earliest scheduled payout surfaces first. Items without a date sort to
  // the end (Infinity). This is pure: no Date.now() during render.
  const allBonuses = household?.bonuses ?? [];
  const sortedBonuses = [...allBonuses].sort((a, b) => {
    const ta = a.expectedDate ? new Date(a.expectedDate).getTime() : Infinity;
    const tb = b.expectedDate ? new Date(b.expectedDate).getTime() : Infinity;
    return ta - tb;
  });
  const rawNext = sortedBonuses[0];
  const nextBonus = rawNext
    ? {
        name: rawNext.name,
        netAmount: calculateBonusNet(
          rawNext.grossAmount,
          rawNext.estimatedTaxRate
        ),
        expectedDate: rawNext.expectedDate,
      }
    : undefined;

  const revolvingDebts = debts.filter(
    (d) => d.debtType === "CREDIT_CARD" || d.debtType === "OTHER_REVOLVING"
  );
  const totalCreditLimit = revolvingDebts.reduce(
    (sum, d) => sum + (d.creditLimit ?? 0),
    0
  );
  const totalRevolvingBalance = revolvingDebts.reduce(
    (sum, d) => sum + d.balance,
    0
  );
  const utilization =
    totalCreditLimit > 0
      ? (totalRevolvingBalance / totalCreditLimit) * 100
      : 0;

  const utilizationCategory =
    utilization <= 10
      ? "optimal"
      : utilization <= 30
        ? "good"
        : utilization <= 50
          ? "acceptable"
          : "high";

  const totalMinPayments = household?.totalMinPayments ?? 0;
  const estimatedPayoffMonths =
    totalMinPayments > 0 ? Math.ceil(totalDebt / totalMinPayments) : 0;

  const isSoloHousehold = (household?.profileCount ?? 1) === 1;

  return (
    <div>
      <div className="flex items-start justify-between">
        <motion.h1
          className="font-serif text-3xl text-text-primary mb-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Your Dashboard
        </motion.h1>
        {/* Settings lost its nav slot (#60) and launches from Home. */}
        <Link
          href="/dashboard/settings"
          aria-label="Settings"
          className="text-text-secondary hover:text-text-primary transition-colors mt-1.5"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
      <p className="text-text-secondary font-sans text-sm mb-8">
        Everything in your plan — one click to adjust any area.
      </p>

      {/* The household heartbeat: Safe-to-Spend for the current Pay Period. */}
      <SafeToSpendCard />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wholeness Score */}
        <Card padding="lg">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-serif text-lg text-text-primary">
              Financial Wholeness
            </h3>
            <Link
              href="/dashboard/automation"
              className="text-accent-gold text-sm font-sans font-medium hover:underline"
            >
              Next steps →
            </Link>
          </div>
          <div className="flex flex-col items-center">
            <WholenessScoreRing score={45} />
            <p className="text-text-secondary text-sm mt-3 text-center font-sans">
              Your score improves as you automate, pay down debt, and check in
              monthly.
            </p>
          </div>
        </Card>

        {/* Monthly Income + Bonuses */}
        <IncomeSummaryCard
          monthlyIncome={monthlyIncome}
          monthlyBonusEquivalent={monthlyBonusEquivalent}
          annualBonusNet={annualBonusNet}
          bonusCount={bonusCount}
          nextBonus={nextBonus}
          hasIncomeSources={hasIncomeSources}
        />

        {/* Spending Plan */}
        <div className="md:col-span-2">
          <SectionHeader
            title="Conscious Spending Plan"
            manageHref="/flow/spending-plan"
            manageLabel="Adjust plan"
          />
          <CSPOverview plan={plan} totalIncome={totalIncome} />
        </div>

        {/* Debt Summary */}
        <Card padding="lg">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-serif text-lg text-text-primary">
              Debt Summary
            </h3>
            <Link
              href="/dashboard/debts"
              className="text-accent-gold text-sm font-sans font-medium hover:underline"
            >
              Manage →
            </Link>
          </div>
          {debts.length === 0 ? (
            <div>
              <p className="text-text-secondary text-sm font-sans">
                No debts tracked yet.
              </p>
              <Link
                href="/dashboard/debts"
                className="text-accent-gold text-sm font-sans mt-2 inline-block hover:underline"
              >
                Add your debts
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-text-secondary text-sm font-sans">
                  Total Household Debt
                </span>
                <span className="font-serif text-2xl text-text-primary">
                  {formatCurrency(totalDebt)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-text-secondary text-sm font-sans">
                  Accounts
                </span>
                <span className="text-text-primary font-sans">
                  {debts.length}
                </span>
              </div>
              {estimatedPayoffMonths > 0 && (
                <div className="flex items-baseline justify-between">
                  <span className="text-text-secondary text-sm font-sans">
                    Est. Payoff (min. payments)
                  </span>
                  <span className="text-text-primary font-sans">
                    {formatMonths(estimatedPayoffMonths)}
                  </span>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Credit Health */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-serif text-lg text-text-primary">
              Credit Health
            </h3>
            <Link
              href="/dashboard/credit"
              className="text-accent-gold text-sm font-sans font-medium hover:underline"
            >
              Improve →
            </Link>
          </div>
          <CreditHealthCard
            utilization={utilization}
            category={utilizationCategory}
            debtCount={debts.length}
            revolvingCount={revolvingDebts.length}
          />
        </div>

        {/* Monthly Check-In Prompt */}
        <div className="md:col-span-2">
          <MonthlyCheckInPrompt />
        </div>

        {/* Add Partner Prompt (for solo households) */}
        {isAuthenticated && isSoloHousehold && (
          <div className="md:col-span-2">
            <AddPartnerPrompt />
          </div>
        )}
      </div>
    </div>
  );
}
