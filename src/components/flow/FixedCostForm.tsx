"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { type FixedCostLineItem } from "@/lib/store/flow-store";
import { useSpendingPlan } from "@/lib/hooks/useSpendingPlan";
import {
  FIXED_COST_CATEGORIES,
  FIXED_COST_MAX_AMOUNT,
  type FixedCostCategory,
} from "@/lib/constants/csp-ranges";

interface FixedCostFormProps {
  // Consumers pass a `key` prop (e.g. `editing?.id ?? "new"`) so this
  // component remounts when switching between add and edit mode. That lets
  // the form state below be initialized purely from props without any effect.
  editing: FixedCostLineItem | null;
  onDone: () => void;
}

export function FixedCostForm({ editing, onDone }: FixedCostFormProps) {
  // Server-authoritative (#50): awaited per-intent actions with optimistic
  // UI + rollback; line-item ids are server-generated and stable.
  const { addLineItem, updateLineItem, error: serverError } = useSpendingPlan();

  const [category, setCategory] = useState<FixedCostCategory>(
    editing?.category ?? "HOUSING"
  );
  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(
    editing ? String(editing.monthlyAmount) : ""
  );
  const [note, setNote] = useState(editing?.note ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): { ok: boolean; value: number } {
    const next: Record<string, string> = {};
    const trimmedName = name.trim();
    if (!trimmedName) next.name = "Name is required";

    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      next.amount = "Enter a valid amount";
    } else if (parsed > FIXED_COST_MAX_AMOUNT) {
      next.amount = `Amount must be ${FIXED_COST_MAX_AMOUNT.toLocaleString("en-US", { style: "currency", currency: "USD" })} or less`;
    }

    setErrors(next);
    return { ok: Object.keys(next).length === 0, value: parsed };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { ok, value } = validate();
    if (!ok) return;

    const trimmedNote = note.trim();
    const input = {
      category,
      name: name.trim(),
      monthlyAmount: value,
      note: trimmedNote.length > 0 ? trimmedNote : undefined,
    };

    setIsSaving(true);
    const saved = editing
      ? await updateLineItem(editing.id, input)
      : await addLineItem(input);
    setIsSaving(false);
    if (!saved) return; // rollback already happened; hook error renders below

    setCategory("HOUSING");
    setName("");
    setAmount("");
    setNote("");
    setErrors({});
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="font-sans text-sm font-medium text-text-primary mb-2 block">
          Category
        </label>
        <div className="flex flex-wrap gap-2">
          {FIXED_COST_CATEGORIES.map((c) => {
            const isActive = c.key === category;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                aria-pressed={isActive}
                className={`px-3 py-1.5 rounded-full text-sm font-sans border transition-colors ${
                  isActive
                    ? "bg-accent-gold text-white border-accent-gold"
                    : "bg-white text-text-primary border-bg-secondary hover:border-accent-gold"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-text-secondary mt-2">
          {FIXED_COST_CATEGORIES.find((c) => c.key === category)?.hint}
        </p>
      </div>

      <Input
        label="Line item name"
        placeholder="e.g. Mortgage, Auto insurance"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />

      <Input
        label="Monthly amount"
        type="number"
        inputMode="decimal"
        min={0}
        max={FIXED_COST_MAX_AMOUNT}
        step="0.01"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={errors.amount}
      />

      <Input
        label="Note (optional)"
        placeholder="e.g. Split with roommate"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          disabled={isSaving}
        >
          {isSaving
            ? "Saving…"
            : editing
              ? "Save changes"
              : "Add line item"}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-red-600 font-sans">
          {serverError}
        </p>
      )}
    </form>
  );
}
