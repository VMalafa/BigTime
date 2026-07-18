"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { type DebtType } from "@/lib/store/flow-store";
import { useDebts } from "@/lib/hooks/useDebts";
import { isPositiveNumber } from "@/lib/utils/validation";

const DEBT_TYPES: { value: DebtType; label: string }[] = [
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "PERSONAL_LOAN", label: "Personal Loan" },
  { value: "STUDENT_LOAN", label: "Student Loan" },
  { value: "AUTO_LOAN", label: "Auto Loan" },
  { value: "MORTGAGE", label: "Mortgage" },
  { value: "MEDICAL", label: "Medical" },
  { value: "OTHER_REVOLVING", label: "Other Revolving" },
  { value: "OTHER_INSTALLMENT", label: "Other Installment" },
];

const REVOLVING_TYPES: DebtType[] = ["CREDIT_CARD", "OTHER_REVOLVING"];

interface DebtEntryFormProps {
  onSubmit?: () => void;
}

export function DebtEntryForm({ onSubmit }: DebtEntryFormProps) {
  // Server-authoritative (#51): awaited per-intent action with optimistic
  // UI + rollback; ids are server-generated and stable.
  const { addDebt, error: serverError } = useDebts();
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [debtType, setDebtType] = useState<DebtType>("CREDIT_CARD");
  const [creditLimit, setCreditLimit] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const isRevolving = REVOLVING_TYPES.includes(debtType);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "Name is required";
    if (!isPositiveNumber(Number(balance)))
      newErrors.balance = "Enter a valid balance";
    if (Number(apr) < 0 || Number(apr) > 100 || apr === "")
      newErrors.apr = "Enter a valid APR (0-100)";
    if (!isPositiveNumber(Number(minimumPayment)))
      newErrors.minimumPayment = "Enter a valid minimum payment";
    if (isRevolving && creditLimit !== "" && Number(creditLimit) < Number(balance))
      newErrors.creditLimit = "Credit limit should be >= balance";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    const added = await addDebt({
      name: name.trim(),
      balance: Number(balance),
      apr: Number(apr),
      minimumPayment: Number(minimumPayment),
      debtType,
      ...(isRevolving && creditLimit ? { creditLimit: Number(creditLimit) } : {}),
    });
    setIsSaving(false);
    if (!added) return; // rollback already happened; hook error renders below

    setName("");
    setBalance("");
    setApr("");
    setMinimumPayment("");
    setDebtType("CREDIT_CARD");
    setCreditLimit("");
    setErrors({});
    onSubmit?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Debt Name"
        placeholder="e.g. Chase Sapphire"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Balance"
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          error={errors.balance}
        />
        <div className="flex flex-col gap-1.5">
          <Input
            label="APR"
            type="number"
            min={0}
            max={100}
            step="0.01"
            placeholder="0.00"
            value={apr}
            onChange={(e) => setApr(e.target.value)}
            error={errors.apr}
            helperText="Interest rate %"
          />
        </div>
      </div>

      <Input
        label="Minimum Payment"
        type="number"
        min={0}
        step="0.01"
        placeholder="0.00"
        value={minimumPayment}
        onChange={(e) => setMinimumPayment(e.target.value)}
        error={errors.minimumPayment}
      />

      <div className="flex flex-col gap-1.5">
        <label className="font-sans text-sm font-medium text-text-primary">
          Debt Type
        </label>
        <select
          value={debtType}
          onChange={(e) => setDebtType(e.target.value as DebtType)}
          className="w-full px-4 py-2.5 rounded-lg border border-bg-secondary bg-white font-sans text-text-primary transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-bg-primary focus:border-accent-gold focus:ring-accent-gold appearance-none cursor-pointer"
        >
          {DEBT_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>
              {dt.label}
            </option>
          ))}
        </select>
      </div>

      {isRevolving && (
        <Input
          label="Credit Limit"
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={creditLimit}
          onChange={(e) => setCreditLimit(e.target.value)}
          error={errors.creditLimit}
          helperText="Used to calculate utilization"
        />
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isSaving}
      >
        {isSaving ? "Adding…" : "Add Debt"}
      </Button>

      {serverError && (
        <p role="alert" className="text-sm text-red-600 font-sans">
          {serverError}
        </p>
      )}
    </form>
  );
}
