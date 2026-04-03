"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useFlowStore, type IncomeEntry } from "@/lib/store/flow-store";
import { generateId, isPositiveNumber } from "@/lib/utils/validation";
import { formatCurrency } from "@/lib/utils/format";

export function IncomeEntryForm() {
  const { incomeSources, addIncome, removeIncome, updateIncome } =
    useFlowStore();

  const [name, setName] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [isAfterTax, setIsAfterTax] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!isPositiveNumber(Number(monthlyAmount)))
      newErrors.monthlyAmount = "Enter a valid amount";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    addIncome({
      id: generateId(),
      name: name.trim(),
      monthlyAmount: Number(monthlyAmount),
      isAfterTax,
    });

    setName("");
    setMonthlyAmount("");
    setIsAfterTax(true);
    setErrors({});
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Income Source"
          placeholder="e.g. Salary, Freelance"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        <Input
          label="Monthly Amount"
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={monthlyAmount}
          onChange={(e) => setMonthlyAmount(e.target.value)}
          error={errors.monthlyAmount}
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={isAfterTax}
            onClick={() => setIsAfterTax(!isAfterTax)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${
              isAfterTax ? "bg-accent-gold" : "bg-bg-secondary"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                isAfterTax ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <label className="font-sans text-sm text-text-primary cursor-pointer">
            {isAfterTax ? "After-tax income" : "Before-tax income"}
          </label>
        </div>

        <Button type="submit" variant="primary" className="w-full">
          Add Income
        </Button>
      </form>

      {incomeSources.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-serif text-lg text-text-primary">
            Your Income Sources
          </h3>
          <AnimatePresence mode="popLayout">
            {incomeSources.map((source: IncomeEntry) => (
              <motion.div
                key={source.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-serif text-text-primary">
                        {source.name}
                      </p>
                      <p className="text-lg font-semibold text-text-primary">
                        {formatCurrency(source.monthlyAmount)}/mo
                      </p>
                      <p className="text-xs text-text-secondary">
                        {source.isAfterTax ? "After-tax" : "Before-tax"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeIncome(source.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
