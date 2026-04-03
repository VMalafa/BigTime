"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useFlowStore } from "@/lib/store/flow-store";
import { useAuth } from "@/lib/hooks/useAuth";
import { getHouseholdFinancials } from "@/app/actions/household";
import { WholenessScoreRing } from "@/components/dashboard/WholenessScoreRing";
import { CSPOverview } from "@/components/dashboard/CSPOverview";
import { CreditHealthCard } from "@/components/dashboard/CreditHealthCard";
import { MonthlyCheckInPrompt } from "@/components/dashboard/MonthlyCheckInPrompt";
import { AddPartnerPrompt } from "@/components/shared/AddPartnerPrompt";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatMonths } from "@/lib/utils/format";
import Link from "next/link";

const defaultPlan = {
  fixedCostsPercent: 55,
  savingsPercent: 10,
  investmentsPercent: 10,
  guiltFreePercent: 25,
};

interface HouseholdData {
  profiles: Array<{ id: string; name: string; moneyType: string | null }>;
  totalDebt: number;
  totalMinPayments: number;
  totalMonthlyIncome: number;
  debtCount: number;
  debts: Array<{
    balance: number;
    debtType: string;
    creditLimit?: number;
  }>;
  profileCount: number;
}

export default function DashboardPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [household, setHousehold] = useState<HouseholdData | null>(null);

  // Fallback to local store for unauthenticated (shouldn't reach dashboard, but safe)
  const localDebts = useFlowStore((s) => s.debts);
  const localPlan = useFlowStore((s) => s.spendingPlan);
  const localGetIncome = useFlowStore((s) => s.getTotalMonthlyIncome);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      getHouseholdFinancials().then(setHousehold);
    }
  }, [isAuthenticated, authLoading]);

  // Use household data if available, fall back to local store
  const debts = household?.debts ?? localDebts;
  const totalDebt = household?.totalDebt ?? debts.reduce((sum, d) => sum + d.balance, 0);
  const totalIncome = household?.totalMonthlyIncome || localGetIncome() || 5000;
  const plan = localPlan ?? defaultPlan;

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

  const totalMinPayments =
    household?.totalMinPayments ??
    localDebts.reduce((sum, d) => sum + d.minimumPayment, 0);
  const estimatedPayoffMonths =
    totalMinPayments > 0 ? Math.ceil(totalDebt / totalMinPayments) : 0;

  const isSoloHousehold = (household?.profileCount ?? 1) === 1;

  return (
    <div>
      <motion.h1
        className="font-serif text-3xl text-text-primary mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Your Dashboard
      </motion.h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wholeness Score */}
        <Card padding="lg">
          <div className="flex flex-col items-center">
            <WholenessScoreRing score={45} />
            <p className="text-text-secondary text-sm mt-3 text-center font-sans">
              Your score improves as you automate, pay down debt, and check in
              monthly.
            </p>
          </div>
        </Card>

        {/* Spending Plan */}
        <div>
          <h2 className="font-serif text-lg text-text-primary mb-3">
            Conscious Spending Plan
          </h2>
          <CSPOverview plan={plan} totalIncome={totalIncome} />
        </div>

        {/* Debt Summary */}
        <Card padding="lg">
          <h3 className="font-serif text-lg text-text-primary mb-3">
            Debt Summary
          </h3>
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
              <Link
                href="/dashboard/debts"
                className="text-accent-gold text-sm font-sans mt-1 inline-block hover:underline"
              >
                View details
              </Link>
            </div>
          )}
        </Card>

        {/* Credit Health */}
        <CreditHealthCard
          utilization={utilization}
          category={utilizationCategory}
          debtCount={debts.length}
          revolvingCount={revolvingDebts.length}
        />

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
