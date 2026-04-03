"use client";

import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils/format";

export type DebtType =
  | "CREDIT_CARD"
  | "PERSONAL_LOAN"
  | "STUDENT_LOAN"
  | "AUTO_LOAN"
  | "MORTGAGE"
  | "MEDICAL"
  | "OTHER_REVOLVING"
  | "OTHER_INSTALLMENT";

const REVOLVING_TYPES: DebtType[] = [
  "CREDIT_CARD",
  "OTHER_REVOLVING",
];

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  CREDIT_CARD: "Credit Card",
  PERSONAL_LOAN: "Personal Loan",
  STUDENT_LOAN: "Student Loan",
  AUTO_LOAN: "Auto Loan",
  MORTGAGE: "Mortgage",
  MEDICAL: "Medical",
  OTHER_REVOLVING: "Other (Revolving)",
  OTHER_INSTALLMENT: "Other (Installment)",
};

export interface DebtEntry {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  type: DebtType;
  creditLimit: number | null;
}

interface DebtInputTableProps {
  debts: DebtEntry[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof DebtEntry, value: string | number | null) => void;
}

function isRevolving(type: DebtType) {
  return REVOLVING_TYPES.includes(type);
}

export function DebtInputTable({
  debts,
  onAdd,
  onRemove,
  onUpdate,
}: DebtInputTableProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bg-secondary text-left text-text-secondary">
              <th className="py-3 px-2 font-medium">Name</th>
              <th className="py-3 px-2 font-medium">Balance</th>
              <th className="py-3 px-2 font-medium">APR %</th>
              <th className="py-3 px-2 font-medium">Min Payment</th>
              <th className="py-3 px-2 font-medium">Type</th>
              <th className="py-3 px-2 font-medium">Credit Limit</th>
              <th className="py-3 px-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {debts.map((debt) => (
              <tr
                key={debt.id}
                className="border-b border-bg-secondary/50 hover:bg-bg-secondary/20 transition-colors"
              >
                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={debt.name}
                    onChange={(e) => onUpdate(debt.id, "name", e.target.value)}
                    placeholder="e.g. Visa Card"
                    className="w-full px-2 py-1.5 rounded border border-bg-secondary bg-white text-text-primary text-sm focus:outline-none focus:border-accent-gold"
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="number"
                    value={debt.balance || ""}
                    onChange={(e) =>
                      onUpdate(debt.id, "balance", Number(e.target.value))
                    }
                    placeholder="$0"
                    min={0}
                    className="w-24 px-2 py-1.5 rounded border border-bg-secondary bg-white text-text-primary text-sm focus:outline-none focus:border-accent-gold"
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="number"
                    value={debt.apr || ""}
                    onChange={(e) =>
                      onUpdate(debt.id, "apr", Number(e.target.value))
                    }
                    placeholder="0"
                    min={0}
                    max={100}
                    step={0.1}
                    className="w-20 px-2 py-1.5 rounded border border-bg-secondary bg-white text-text-primary text-sm focus:outline-none focus:border-accent-gold"
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="number"
                    value={debt.minimumPayment || ""}
                    onChange={(e) =>
                      onUpdate(
                        debt.id,
                        "minimumPayment",
                        Number(e.target.value)
                      )
                    }
                    placeholder="$0"
                    min={0}
                    className="w-24 px-2 py-1.5 rounded border border-bg-secondary bg-white text-text-primary text-sm focus:outline-none focus:border-accent-gold"
                  />
                </td>
                <td className="py-2 px-2">
                  <select
                    value={debt.type}
                    onChange={(e) =>
                      onUpdate(debt.id, "type", e.target.value)
                    }
                    className="w-full px-2 py-1.5 rounded border border-bg-secondary bg-white text-text-primary text-sm focus:outline-none focus:border-accent-gold"
                  >
                    {(Object.keys(DEBT_TYPE_LABELS) as DebtType[]).map(
                      (type) => (
                        <option key={type} value={type}>
                          {DEBT_TYPE_LABELS[type]}
                        </option>
                      )
                    )}
                  </select>
                </td>
                <td className="py-2 px-2">
                  {isRevolving(debt.type) ? (
                    <input
                      type="number"
                      value={debt.creditLimit ?? ""}
                      onChange={(e) =>
                        onUpdate(
                          debt.id,
                          "creditLimit",
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      placeholder="$0"
                      min={0}
                      className="w-24 px-2 py-1.5 rounded border border-bg-secondary bg-white text-text-primary text-sm focus:outline-none focus:border-accent-gold"
                    />
                  ) : (
                    <span className="text-text-secondary text-xs">N/A</span>
                  )}
                </td>
                <td className="py-2 px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(debt.id)}
                    className="text-error hover:text-error/80"
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden flex flex-col gap-3">
        {debts.map((debt) => (
          <div
            key={debt.id}
            className="bg-white rounded-lg border border-bg-secondary p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={debt.name}
                onChange={(e) => onUpdate(debt.id, "name", e.target.value)}
                placeholder="Debt name"
                className="font-medium text-text-primary text-sm px-2 py-1.5 rounded border border-bg-secondary bg-white focus:outline-none focus:border-accent-gold flex-1 mr-2"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(debt.id)}
                className="text-error hover:text-error/80 shrink-0"
              >
                Remove
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-secondary mb-1 block">
                  Balance
                </label>
                <input
                  type="number"
                  value={debt.balance || ""}
                  onChange={(e) =>
                    onUpdate(debt.id, "balance", Number(e.target.value))
                  }
                  placeholder="$0"
                  min={0}
                  className="w-full px-2 py-1.5 rounded border border-bg-secondary bg-white text-text-primary text-sm focus:outline-none focus:border-accent-gold"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">
                  APR %
                </label>
                <input
                  type="number"
                  value={debt.apr || ""}
                  onChange={(e) =>
                    onUpdate(debt.id, "apr", Number(e.target.value))
                  }
                  placeholder="0"
                  min={0}
                  max={100}
                  step={0.1}
                  className="w-full px-2 py-1.5 rounded border border-bg-secondary bg-white text-text-primary text-sm focus:outline-none focus:border-accent-gold"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">
                  Min Payment
                </label>
                <input
                  type="number"
                  value={debt.minimumPayment || ""}
                  onChange={(e) =>
                    onUpdate(
                      debt.id,
                      "minimumPayment",
                      Number(e.target.value)
                    )
                  }
                  placeholder="$0"
                  min={0}
                  className="w-full px-2 py-1.5 rounded border border-bg-secondary bg-white text-text-primary text-sm focus:outline-none focus:border-accent-gold"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">
                  Type
                </label>
                <select
                  value={debt.type}
                  onChange={(e) =>
                    onUpdate(debt.id, "type", e.target.value)
                  }
                  className="w-full px-2 py-1.5 rounded border border-bg-secondary bg-white text-text-primary text-sm focus:outline-none focus:border-accent-gold"
                >
                  {(Object.keys(DEBT_TYPE_LABELS) as DebtType[]).map(
                    (type) => (
                      <option key={type} value={type}>
                        {DEBT_TYPE_LABELS[type]}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {isRevolving(debt.type) && (
              <div>
                <label className="text-xs text-text-secondary mb-1 block">
                  Credit Limit
                </label>
                <input
                  type="number"
                  value={debt.creditLimit ?? ""}
                  onChange={(e) =>
                    onUpdate(
                      debt.id,
                      "creditLimit",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  placeholder="$0"
                  min={0}
                  className="w-full px-2 py-1.5 rounded border border-bg-secondary bg-white text-text-primary text-sm focus:outline-none focus:border-accent-gold"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {debts.length === 0 && (
        <p className="text-center text-text-secondary text-sm py-8">
          No debts added yet. Click below to add your first debt.
        </p>
      )}

      <Button variant="secondary" onClick={onAdd} className="self-start">
        + Add Debt
      </Button>
    </div>
  );
}
