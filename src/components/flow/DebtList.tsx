"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { type DebtEntry } from "@/lib/store/flow-store";
import { formatCurrency, formatPercentExact } from "@/lib/utils/format";

const DEBT_TYPE_LABELS: Record<string, string> = {
  CREDIT_CARD: "Credit Card",
  PERSONAL_LOAN: "Personal Loan",
  STUDENT_LOAN: "Student Loan",
  AUTO_LOAN: "Auto Loan",
  MORTGAGE: "Mortgage",
  MEDICAL: "Medical",
  OTHER_REVOLVING: "Other Revolving",
  OTHER_INSTALLMENT: "Other Installment",
};

const REVOLVING_TYPES = ["CREDIT_CARD", "OTHER_REVOLVING"];

interface DebtListProps {
  debts: DebtEntry[];
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}

export function DebtList({ debts, onEdit, onRemove }: DebtListProps) {
  if (debts.length === 0) return null;

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {debts.map((debt) => {
          const isRevolving = REVOLVING_TYPES.includes(debt.debtType);
          const utilization =
            isRevolving && debt.creditLimit && debt.creditLimit > 0
              ? (debt.balance / debt.creditLimit) * 100
              : null;

          return (
            <motion.div
              key={debt.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-serif text-lg text-text-primary truncate">
                        {debt.name}
                      </h3>
                      <Badge variant="blue">
                        {DEBT_TYPE_LABELS[debt.debtType] ?? debt.debtType}
                      </Badge>
                    </div>
                    <p className="text-2xl font-semibold text-text-primary mb-2">
                      {formatCurrency(debt.balance)}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                      <span>APR: {formatPercentExact(debt.apr)}</span>
                      <span>
                        Min: {formatCurrency(debt.minimumPayment)}/mo
                      </span>
                      {utilization !== null && (
                        <span
                          className={
                            utilization > 30
                              ? "text-warning"
                              : "text-cat-green"
                          }
                        >
                          Utilization: {formatPercentExact(utilization)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(debt.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(debt.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
