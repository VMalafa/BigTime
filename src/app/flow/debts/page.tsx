"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { FlowNavigation } from "@/components/flow/FlowNavigation";
import { DebtEntryForm } from "@/components/flow/DebtEntryForm";
import { DebtProposalsPanel } from "@/components/proposals/DebtProposalsPanel";
import { DebtList } from "@/components/flow/DebtList";
import { useFlowStore } from "@/lib/store/flow-store";
import { formatCurrency } from "@/lib/utils/format";

const REVOLVING_TYPES = ["CREDIT_CARD", "OTHER_REVOLVING"];

export default function DebtsPage() {
  const router = useRouter();
  const { debts, removeDebt, setCurrentStep } = useFlowStore();

  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalMinPayments = debts.reduce((sum, d) => sum + d.minimumPayment, 0);

  const revolvingDebts = debts.filter((d) => REVOLVING_TYPES.includes(d.debtType));
  const revolvingBalance = revolvingDebts.reduce((sum, d) => sum + d.balance, 0);
  const revolvingLimit = revolvingDebts.reduce(
    (sum, d) => sum + (d.creditLimit ?? 0),
    0
  );
  const aggregateUtilization =
    revolvingLimit > 0 ? (revolvingBalance / revolvingLimit) * 100 : null;

  function handleNext() {
    setCurrentStep(3);
    router.push("/flow/income");
  }

  function handleBack() {
    router.push("/flow/money-type");
  }

  function handleEdit(id: string) {
    // For now, remove and let them re-add (simple approach)
    // A modal-based edit could be added later
  }

  return (
    <StepWrapper
      title="Let's see the full picture"
      subtitle="No judgment. Debt isn't a moral failing — it's a tool that sometimes needs restructuring."
    >
      <div className="space-y-8">
        {/* Debt Proposals from mappable Linked Accounts (linked path);
            manual entry stays below for whatever the feed missed. */}
        <DebtProposalsPanel />

        <DebtEntryForm />

        {debts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <p className="text-text-secondary font-serif text-lg">
              No debt? That&apos;s amazing! Skip ahead.
            </p>
          </motion.div>
        )}

        <DebtList debts={debts} onEdit={handleEdit} onRemove={removeDebt} />

        {debts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-bg-secondary p-5 space-y-2"
          >
            <div className="flex justify-between">
              <span className="text-text-secondary">Total Debt</span>
              <span className="font-semibold text-text-primary">
                {formatCurrency(totalDebt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Total Minimum Payments</span>
              <span className="font-semibold text-text-primary">
                {formatCurrency(totalMinPayments)}/mo
              </span>
            </div>
            {aggregateUtilization !== null && (
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  Revolving Utilization
                </span>
                <span
                  className={`font-semibold ${
                    aggregateUtilization > 30
                      ? "text-warning"
                      : "text-cat-green"
                  }`}
                >
                  {aggregateUtilization.toFixed(1)}%
                </span>
              </div>
            )}
          </motion.div>
        )}

        <FlowNavigation
          onBack={handleBack}
          onNext={handleNext}
          nextLabel={debts.length === 0 ? "Skip — No Debt" : "Continue"}
          showBack
        />
      </div>
    </StepWrapper>
  );
}
