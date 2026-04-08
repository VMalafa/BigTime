"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  useFlowStore,
  type BonusEntry,
  type BonusFrequency,
} from "@/lib/store/flow-store";
import { generateId, isPositiveNumber } from "@/lib/utils/validation";
import { formatCurrency } from "@/lib/utils/format";
import {
  DEFAULT_BONUS_TAX_RATE,
  FREQUENCY_LABELS,
  calculateBonusNet,
  calculateMonthlyEquivalent,
} from "@/lib/calculations/bonus-tax";

const FREQUENCY_OPTIONS: { value: BonusFrequency; label: string; hint: string }[] =
  [
    { value: "ONE_TIME", label: "One-time", hint: "Single payout" },
    { value: "QUARTERLY", label: "Quarterly", hint: "4x per year" },
    { value: "SEMI_ANNUAL", label: "Semi-annual", hint: "2x per year" },
    { value: "ANNUAL", label: "Annual", hint: "1x per year" },
  ];

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BonusEntryForm() {
  const bonusItems = useFlowStore((s) => s.bonusItems);
  const addBonus = useFlowStore((s) => s.addBonus);
  const removeBonus = useFlowStore((s) => s.removeBonus);

  const [name, setName] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [taxRate, setTaxRate] = useState(String(DEFAULT_BONUS_TAX_RATE));
  const [frequency, setFrequency] = useState<BonusFrequency>("ANNUAL");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name is required";
    if (!isPositiveNumber(Number(grossAmount)))
      next.grossAmount = "Enter a valid amount";
    const rate = Number(taxRate);
    if (!isFinite(rate) || rate < 0 || rate > 100)
      next.taxRate = "Tax rate must be 0-100";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    addBonus({
      id: generateId(),
      name: name.trim(),
      grossAmount: Number(grossAmount),
      estimatedTaxRate: Number(taxRate),
      frequency,
      expectedDate: expectedDate || undefined,
      notes: notes.trim() || undefined,
    });
    setName("");
    setGrossAmount("");
    setTaxRate(String(DEFAULT_BONUS_TAX_RATE));
    setFrequency("ANNUAL");
    setExpectedDate("");
    setNotes("");
    setErrors({});
  }

  // Live preview of net
  const grossNum = Number(grossAmount);
  const rateNum = Number(taxRate);
  const preview =
    isPositiveNumber(grossNum) && isFinite(rateNum)
      ? {
          net: calculateBonusNet(grossNum, rateNum),
          tax: grossNum * (rateNum / 100),
        }
      : null;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Bonus Name"
          placeholder="e.g. Annual performance bonus"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Gross Amount"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={grossAmount}
            onChange={(e) => setGrossAmount(e.target.value)}
            error={errors.grossAmount}
            helperText="Before taxes"
          />

          <Input
            label="Est. Tax Rate (%)"
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            error={errors.taxRate}
            helperText={`Default ${DEFAULT_BONUS_TAX_RATE}% (fed + FICA + state)`}
          />
        </div>

        <div>
          <p className="font-sans text-sm font-medium text-text-primary mb-2">
            Frequency
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FREQUENCY_OPTIONS.map((opt) => {
              const active = frequency === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFrequency(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-accent-gold bg-accent-gold/10"
                      : "border-bg-secondary bg-white hover:border-accent-gold/50"
                  }`}
                >
                  <p
                    className={`font-sans text-sm font-medium ${
                      active ? "text-accent-gold" : "text-text-primary"
                    }`}
                  >
                    {opt.label}
                  </p>
                  <p className="text-xs text-text-secondary font-sans">
                    {opt.hint}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Expected Date (optional)"
          type="date"
          value={expectedDate}
          onChange={(e) => setExpectedDate(e.target.value)}
          helperText="When do you expect the next payout?"
        />

        <Input
          label="Notes (optional)"
          placeholder="Performance target, vesting, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-bg-secondary/60 p-4 space-y-1"
          >
            <div className="flex justify-between text-sm font-sans">
              <span className="text-text-secondary">Gross</span>
              <span className="text-text-primary">
                {formatCurrency(grossNum)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-sans">
              <span className="text-text-secondary">
                Est. tax ({rateNum}%)
              </span>
              <span className="text-text-primary">
                −{formatCurrency(preview.tax)}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-bg-secondary">
              <span className="font-serif text-text-primary">
                Est. net take-home
              </span>
              <span className="font-serif text-lg text-accent-gold">
                {formatCurrency(preview.net)}
              </span>
            </div>
          </motion.div>
        )}

        <Button type="submit" variant="primary" className="w-full">
          Add Bonus
        </Button>
      </form>

      {bonusItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-serif text-lg text-text-primary">
            Your Bonuses
          </h3>
          <AnimatePresence mode="popLayout">
            {bonusItems.map((bonus: BonusEntry) => {
              const net = calculateBonusNet(
                bonus.grossAmount,
                bonus.estimatedTaxRate
              );
              const monthly = calculateMonthlyEquivalent(bonus);
              return (
                <motion.div
                  key={bonus.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-serif text-text-primary">
                            {bonus.name}
                          </p>
                          <Badge variant="default">
                            {FREQUENCY_LABELS[bonus.frequency]}
                          </Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-sans">
                          <div>
                            <p className="text-xs text-text-secondary">
                              Gross
                            </p>
                            <p className="text-text-primary">
                              {formatCurrency(bonus.grossAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-text-secondary">
                              Est. net
                            </p>
                            <p className="font-semibold text-accent-gold">
                              {formatCurrency(net)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-text-secondary">
                              Tax rate
                            </p>
                            <p className="text-text-primary">
                              {bonus.estimatedTaxRate}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-text-secondary">
                              Monthly equiv.
                            </p>
                            <p className="text-text-primary">
                              {formatCurrency(monthly)}/mo
                            </p>
                          </div>
                        </div>
                        {bonus.expectedDate && (
                          <p className="mt-2 text-xs text-text-secondary font-sans">
                            Expected {formatDate(bonus.expectedDate)}
                          </p>
                        )}
                        {bonus.notes && (
                          <p className="mt-1 text-xs text-text-secondary font-sans italic">
                            {bonus.notes}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBonus(bonus.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
