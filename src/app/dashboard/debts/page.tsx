"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFlowStore, type DebtEntry } from "@/lib/store/flow-store";
import { getMappedDebtCaptions } from "@/app/actions/aggregator";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DebtPayoffChart } from "@/components/dashboard/DebtPayoffChart";
import { formatAsOf, formatCurrency, formatPercentExact } from "@/lib/utils/format";
import Link from "next/link";

// Sync caption for a Debt whose balance is feed-owned (see Mapping in
// CONTEXT.md). Held in transient React state only — never persisted
// client-side.
interface SyncCaption {
  institution: string;
  balanceAsOf: string;
}

const debtTypeLabels: Record<string, string> = {
  CREDIT_CARD: "Credit Card",
  PERSONAL_LOAN: "Personal Loan",
  STUDENT_LOAN: "Student Loan",
  AUTO_LOAN: "Auto Loan",
  MORTGAGE: "Mortgage",
  MEDICAL: "Medical",
  OTHER_REVOLVING: "Other Revolving",
  OTHER_INSTALLMENT: "Other Installment",
};

function generatePayoffData(debt: DebtEntry): { month: number; balance: number }[] {
  if (debt.balance <= 0 || debt.minimumPayment <= 0) return [];

  const data: { month: number; balance: number }[] = [];
  let balance = debt.balance;
  let month = 0;
  const monthlyRate = debt.apr / 100 / 12;

  data.push({ month, balance });

  while (balance > 0 && month < 360) {
    month++;
    const interest = balance * monthlyRate;
    const payment = Math.min(debt.minimumPayment, balance + interest);
    balance = Math.max(0, balance + interest - payment);
    data.push({ month, balance: Math.round(balance) });
  }

  return data;
}

function DebtCard({
  debt,
  syncCaption,
}: {
  debt: DebtEntry;
  syncCaption?: SyncCaption;
}) {
  const updateDebt = useFlowStore((s) => s.updateDebt);
  const [editing, setEditing] = useState(false);
  const [newBalance, setNewBalance] = useState(debt.balance.toString());

  const isPaidOff = debt.balance <= 0;
  const payoffData = generatePayoffData(debt);

  const handleSave = () => {
    const parsed = parseFloat(newBalance);
    if (!isNaN(parsed) && parsed >= 0) {
      updateDebt(debt.id, { balance: parsed });
    }
    setEditing(false);
  };

  return (
    <Card padding="lg">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-serif text-lg text-text-primary">{debt.name}</h3>
          <span className="text-text-secondary text-xs font-sans">
            {debtTypeLabels[debt.debtType] ?? debt.debtType}
          </span>
        </div>
        {isPaidOff && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-success/10 text-success text-xs font-sans font-medium px-2.5 py-1 rounded-full"
          >
            Paid Off!
          </motion.div>
        )}
      </div>

      {isPaidOff ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-4"
        >
          <p className="font-serif text-2xl text-success mb-1">
            Congratulations!
          </p>
          <p className="text-text-secondary text-sm font-sans">
            You&apos;ve paid off this debt. That&apos;s a huge win for your Rich
            Life.
          </p>
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-text-secondary text-xs font-sans">
                Current Balance
              </p>
              {syncCaption ? (
                // The feed owns this balance: read-only, with its freshness
                // labeled (Honesty Rule) and an affordance to manage the link.
                <div>
                  <span className="font-serif text-2xl text-text-primary">
                    {formatCurrency(debt.balance)}
                  </span>
                  <p className="text-text-secondary text-xs font-sans mt-0.5">
                    Synced from {syncCaption.institution} ·{" "}
                    {formatAsOf(syncCaption.balanceAsOf)} ·{" "}
                    <Link
                      href="/settings/connections"
                      className="text-accent-gold hover:underline"
                    >
                      Manage
                    </Link>
                  </p>
                </div>
              ) : (
              <AnimatePresence mode="wait">
                {editing ? (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 mt-1"
                  >
                    <Input
                      type="number"
                      value={newBalance}
                      onChange={(e) => setNewBalance(e.target.value)}
                      className="w-28"
                    />
                    <Button variant="primary" size="sm" onClick={handleSave}>
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="display"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-baseline gap-2"
                  >
                    <span className="font-serif text-2xl text-text-primary">
                      {formatCurrency(debt.balance)}
                    </span>
                    <button
                      onClick={() => {
                        setNewBalance(debt.balance.toString());
                        setEditing(true);
                      }}
                      className="text-accent-gold text-xs font-sans hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              )}
            </div>
            <div>
              <p className="text-text-secondary text-xs font-sans">APR</p>
              <p className="font-serif text-lg text-text-primary mt-0.5">
                {formatPercentExact(debt.apr)}
              </p>
            </div>
            <div>
              <p className="text-text-secondary text-xs font-sans">
                Min. Payment
              </p>
              <p className="font-serif text-lg text-text-primary mt-0.5">
                {formatCurrency(debt.minimumPayment)}/mo
              </p>
            </div>
            {debt.creditLimit != null && debt.creditLimit > 0 && (
              <div>
                <p className="text-text-secondary text-xs font-sans">
                  Credit Limit
                </p>
                <p className="font-serif text-lg text-text-primary mt-0.5">
                  {formatCurrency(debt.creditLimit)}
                </p>
              </div>
            )}
          </div>

          {payoffData.length > 1 && (
            <DebtPayoffChart data={payoffData} strategyName="Minimum Payments" />
          )}
        </>
      )}
    </Card>
  );
}

export default function DebtsPage() {
  const debts = useFlowStore((s) => s.debts);
  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);

  // Which debts are feed-owned, fetched fresh per view (not persisted).
  const [syncCaptions, setSyncCaptions] = useState<Record<string, SyncCaption>>({});
  useEffect(() => {
    let cancelled = false;
    getMappedDebtCaptions()
      .then((captions) => {
        if (cancelled) return;
        setSyncCaptions(
          Object.fromEntries(
            captions.map((c) => [
              c.debtId,
              { institution: c.institution, balanceAsOf: c.balanceAsOf },
            ])
          )
        );
      })
      .catch(() => {
        // Anonymous/offline sessions simply see the manual experience.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <motion.h1
        className="font-serif text-3xl text-text-primary mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Debt Tracking
      </motion.h1>
      <p className="text-text-secondary font-sans text-sm mb-8">
        Track your debts and watch the balances go down over time.
      </p>

      {debts.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-6">
            <p className="font-serif text-lg text-text-primary mb-2">
              No debts tracked yet
            </p>
            <p className="text-text-secondary text-sm font-sans mb-4">
              Complete the onboarding flow to add your debts, or use the
              calculator to explore payoff strategies.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/flow">
                <Button variant="primary" size="md">
                  Start Flow
                </Button>
              </Link>
              <Link href="/calculator">
                <Button variant="secondary" size="md">
                  Debt Calculator
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card padding="md" className="mb-6">
            <div className="flex items-baseline justify-between">
              <span className="text-text-secondary text-sm font-sans">
                Total Remaining Debt
              </span>
              <span className="font-serif text-2xl text-text-primary">
                {formatCurrency(totalDebt)}
              </span>
            </div>
          </Card>

          <div className="space-y-6">
            {debts.map((debt) => (
              <DebtCard
                key={debt.id}
                debt={debt}
                syncCaption={syncCaptions[debt.id]}
              />
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/calculator">
              <Button variant="secondary" size="md">
                Compare Payoff Strategies
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
