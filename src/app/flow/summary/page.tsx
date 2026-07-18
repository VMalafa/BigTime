"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import type { DialCategory } from "@/lib/store/flow-store";
import { useReflection } from "@/lib/hooks/useReflection";
import { useDebts } from "@/lib/hooks/useDebts";
import { useIncomeData } from "@/lib/hooks/useIncomeData";
import { useSpendingPlan } from "@/lib/hooks/useSpendingPlan";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { CSPOverview } from "@/components/dashboard/CSPOverview";
import { CreditHealthCard } from "@/components/dashboard/CreditHealthCard";
import { AuthorQuote } from "@/components/shared/AuthorQuote";
import { SavePrompt } from "@/components/shared/SavePrompt";
import { AddPartnerPrompt } from "@/components/shared/AddPartnerPrompt";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MONEY_TYPES } from "@/lib/constants/money-types";
import { MONEY_DIALS } from "@/lib/constants/money-dials";
import { AUTHOR_WISDOM } from "@/lib/constants/author-wisdom";
import { formatCurrency } from "@/lib/utils/format";

const REVOLVING_TYPES = new Set([
  "CREDIT_CARD",
  "OTHER_REVOLVING",
]);

export default function SummaryPage() {
  const router = useRouter();
  // Server truth via the per-intent hooks (#53) — nothing here reads the
  // UI-state store.
  const { moneyType, moneyDials } = useReflection();
  const { debts } = useDebts();
  const { incomeSources, totalMonthlyIncome: totalIncome } = useIncomeData();
  const { spendingPlan } = useSpendingPlan();

  // --- Money Dials sorted ---
  const sortedDials = useMemo(() => {
    const entries = (Object.entries(moneyDials) as [DialCategory, number][])
      .map(([category, value]) => {
        const dial = MONEY_DIALS.find((d) => d.category === category);
        return { category, value, name: dial?.name ?? category, icon: dial?.icon ?? "" };
      })
      .sort((a, b) => b.value - a.value);
    return entries;
  }, [moneyDials]);

  const topDials = sortedDials.slice(0, 3);
  const bottomDials = sortedDials.slice(-3).reverse();

  // --- Credit Health ---
  const creditHealth = useMemo(() => {
    const revolvingDebts = debts.filter((d) => REVOLVING_TYPES.has(d.debtType));
    const revolvingCount = revolvingDebts.length;

    if (revolvingCount === 0) {
      return { utilization: 0, category: "optimal" as const, revolvingCount: 0 };
    }

    const totalBalance = revolvingDebts.reduce((sum, d) => sum + d.balance, 0);
    const totalLimit = revolvingDebts.reduce((sum, d) => sum + (d.creditLimit ?? 0), 0);
    const utilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

    let category: "optimal" | "good" | "acceptable" | "high";
    if (utilization < 7) category = "optimal";
    else if (utilization < 10) category = "good";
    else if (utilization < 30) category = "acceptable";
    else category = "high";

    return { utilization, category, revolvingCount };
  }, [debts]);

  // --- Debt summary ---
  const debtSummary = useMemo(() => {
    if (debts.length === 0) return null;
    const totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
    const totalMinPayments = debts.reduce((sum, d) => sum + d.minimumPayment, 0);
    return { count: debts.length, totalBalance, totalMinPayments };
  }, [debts]);

  // --- Author quote ---
  const authorQuote = useMemo(() => {
    const typeKey = moneyType ?? "OPTIMIZER";
    const quotes = AUTHOR_WISDOM[typeKey];
    const general = quotes.find((q) => q.context === "general");
    return general ?? quotes[0];
  }, [moneyType]);

  const { isAuthenticated, loading: authLoading } = useAuth();

  const handleBack = () => {
    router.push("/flow/money-dials");
  };

  const sectionDelay = 0.1;

  return (
    <StepWrapper
      title="Your Rich Life Plan"
      subtitle="Here's everything in one place."
    >
      <div className="flex flex-col gap-8">
        {/* Money Type */}
        {moneyType && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionDelay * 1, duration: 0.4 }}
          >
            <Card padding="md">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{MONEY_TYPES[moneyType].emoji}</span>
                <h3 className="font-serif text-lg text-text-primary">
                  {MONEY_TYPES[moneyType].name}
                </h3>
                <Badge variant="default">{moneyType}</Badge>
              </div>
              <p className="text-text-secondary text-sm">
                {MONEY_TYPES[moneyType].description}
              </p>
            </Card>
          </motion.section>
        )}

        {/* CSP Overview */}
        {spendingPlan && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionDelay * 2, duration: 0.4 }}
          >
            <h2 className="font-serif text-xl text-text-primary mb-4">
              Conscious Spending Plan
            </h2>
            <CSPOverview plan={spendingPlan} totalIncome={totalIncome} />
          </motion.section>
        )}

        {/* Debt Overview */}
        {debtSummary && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionDelay * 3, duration: 0.4 }}
          >
            <Card padding="md">
              <h3 className="font-serif text-lg text-text-primary mb-3">
                Debt Overview
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-text-secondary text-xs font-sans">Accounts</p>
                  <p className="font-serif text-xl text-text-primary">
                    {debtSummary.count}
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs font-sans">
                    Total Balance
                  </p>
                  <p className="font-serif text-xl text-text-primary">
                    {formatCurrency(debtSummary.totalBalance)}
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs font-sans">
                    Min. Payments
                  </p>
                  <p className="font-serif text-xl text-text-primary">
                    {formatCurrency(debtSummary.totalMinPayments)}/mo
                  </p>
                </div>
              </div>
              <p className="text-text-secondary text-sm">
                Visit the{" "}
                <Link
                  href="/calculator"
                  className="text-accent-gold underline underline-offset-2 hover:text-accent-gold-light"
                >
                  Debt Payoff Calculator
                </Link>{" "}
                to compare strategies.
              </p>
            </Card>
          </motion.section>
        )}

        {/* Money Dials */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: sectionDelay * 4, duration: 0.4 }}
        >
          <h2 className="font-serif text-xl text-text-primary mb-4">
            Money Dials
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card padding="md">
              <h4 className="font-sans text-sm font-medium text-text-secondary mb-3">
                Turn it up
              </h4>
              <div className="flex flex-col gap-2">
                {topDials.map((dial) => (
                  <div key={dial.category} className="flex items-center gap-2">
                    <span className="text-lg">{dial.icon}</span>
                    <span className="text-sm text-text-primary font-sans flex-1">
                      {dial.name}
                    </span>
                    <span
                      className="font-serif text-lg font-bold"
                      style={{
                        color: `color-mix(in srgb, var(--accent-gold) ${Math.round(40 + (dial.value / 10) * 60)}%, var(--text-secondary))`,
                      }}
                    >
                      {dial.value}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
            <Card padding="md">
              <h4 className="font-sans text-sm font-medium text-text-secondary mb-3">
                Areas to cut
              </h4>
              <div className="flex flex-col gap-2">
                {bottomDials.map((dial) => (
                  <div key={dial.category} className="flex items-center gap-2">
                    <span className="text-lg">{dial.icon}</span>
                    <span className="text-sm text-text-primary font-sans flex-1">
                      {dial.name}
                    </span>
                    <span className="font-serif text-lg font-bold text-text-secondary">
                      {dial.value}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </motion.section>

        {/* Credit Health */}
        {debts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionDelay * 5, duration: 0.4 }}
          >
            <CreditHealthCard
              utilization={creditHealth.utilization}
              category={creditHealth.category}
              debtCount={debts.length}
              revolvingCount={creditHealth.revolvingCount}
            />
          </motion.section>
        )}

        {/* Author Quote */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: sectionDelay * 6, duration: 0.4 }}
        >
          <AuthorQuote author={authorQuote.author} quote={authorQuote.quote} />
        </motion.section>

        {/* Save Prompt / Add Partner */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: sectionDelay * 7, duration: 0.4 }}
        >
          {!authLoading && (isAuthenticated ? <AddPartnerPrompt /> : <SavePrompt />)}
        </motion.section>
      </div>

      <FlowNavigation
        onBack={handleBack}
        onNext={() => router.push("/")}
        nextLabel="Done"
        showBack={true}
      />
    </StepWrapper>
  );
}
