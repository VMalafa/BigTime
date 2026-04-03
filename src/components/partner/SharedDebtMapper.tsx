"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils/format";
import type { DebtEntry } from "@/lib/store/flow-store";

interface SharedDebtMapperProps {
  debts: DebtEntry[];
  sharedDebtIds: string[];
  onToggle: (debtId: string) => void;
}

export function SharedDebtMapper({
  debts,
  sharedDebtIds,
  onToggle,
}: SharedDebtMapperProps) {
  const sharedDebts = debts.filter((d) => sharedDebtIds.includes(d.id));
  const individualDebts = debts.filter((d) => !sharedDebtIds.includes(d.id));
  const sharedTotal = sharedDebts.reduce((sum, d) => sum + d.balance, 0);
  const individualTotal = individualDebts.reduce(
    (sum, d) => sum + d.balance,
    0
  );

  return (
    <div className="flex flex-col gap-4">
      {debts.length === 0 && (
        <div className="text-center py-8">
          <p className="font-sans text-text-secondary">
            No debts to categorize. You can add debts in the main flow.
          </p>
        </div>
      )}

      {debts.map((debt, i) => {
        const isShared = sharedDebtIds.includes(debt.id);

        return (
          <motion.div
            key={debt.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
          >
            <Card
              className={`transition-colors duration-200 ${
                isShared ? "border-accent-gold/40" : "border-bg-secondary"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-sans text-sm font-medium text-text-primary truncate">
                      {debt.name}
                    </h3>
                    <Badge variant={isShared ? "default" : "blue"}>
                      {isShared ? "Shared" : "Individual"}
                    </Badge>
                  </div>
                  <p className="font-sans text-xs text-text-secondary">
                    {formatCurrency(debt.balance)} at {debt.apr}% APR
                  </p>
                </div>

                <button
                  onClick={() => onToggle(debt.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-gold focus:ring-offset-2 focus:ring-offset-bg-primary ${
                    isShared ? "bg-accent-gold" : "bg-bg-secondary"
                  }`}
                  role="switch"
                  aria-checked={isShared}
                  aria-label={`Mark ${debt.name} as ${isShared ? "individual" : "shared"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      isShared ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </Card>
          </motion.div>
        );
      })}

      {debts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="grid grid-cols-2 gap-4 mt-4"
        >
          <Card className="border-accent-gold/30">
            <div className="text-center">
              <p className="font-sans text-xs text-text-secondary uppercase tracking-wide mb-1">
                Shared Debts
              </p>
              <p className="font-serif text-xl text-text-primary">
                {sharedDebts.length}
              </p>
              <p className="font-sans text-sm text-accent-gold font-medium">
                {formatCurrency(sharedTotal)}
              </p>
            </div>
          </Card>
          <Card className="border-cat-blue/30">
            <div className="text-center">
              <p className="font-sans text-xs text-text-secondary uppercase tracking-wide mb-1">
                Individual Debts
              </p>
              <p className="font-serif text-xl text-text-primary">
                {individualDebts.length}
              </p>
              <p className="font-sans text-sm text-cat-blue font-medium">
                {formatCurrency(individualTotal)}
              </p>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
