"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { correctTransaction } from "@/app/actions/corrections";
import { FIXED_COST_CATEGORIES } from "@/lib/constants/csp-ranges";
import { MONEY_DIALS } from "@/lib/constants/money-dials";
import type { CorrectionInput } from "@/lib/categorization/corrections";

// Inline Corrections (CONTEXT.md): tap a transaction, pick the bucket, then
// the Money Dial / fixed-cost category as applicable. Saved optimistically —
// the row updates immediately while the rule writes in the background.

export interface CorrectableRow {
  id: string;
  description: string;
  metaLabel: string; // "Jul 3 · E2E Checking · Housing"
  amountLabel: string; // "-$1,800"
  isTransfer: boolean;
}

const BUCKET_OPTIONS = [
  { key: "FIXED_COSTS", label: "Fixed Costs" },
  { key: "SAVINGS", label: "Savings" },
  { key: "INVESTMENTS", label: "Investments" },
  { key: "GUILT_FREE", label: "Guilt-Free" },
] as const;

type BucketKey = (typeof BUCKET_OPTIONS)[number]["key"] | "TRANSFER";

function optionLabel(bucket: BucketKey, second: string | null): string {
  if (bucket === "TRANSFER") return "Transfer between your accounts";
  const base = BUCKET_OPTIONS.find((b) => b.key === bucket)?.label ?? bucket;
  if (bucket === "GUILT_FREE" && second) {
    return `${base} · ${MONEY_DIALS.find((d) => d.category === second)?.name ?? second}`;
  }
  if (bucket === "FIXED_COSTS" && second) {
    return `${base} · ${FIXED_COST_CATEGORIES.find((c) => c.key === second)?.label ?? second}`;
  }
  return base;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 rounded-full text-xs font-sans border transition-colors ${
        active
          ? "bg-accent-gold text-white border-accent-gold"
          : "bg-white text-text-primary border-bg-secondary hover:border-accent-gold"
      }`}
    >
      {children}
    </button>
  );
}

export function CorrectableTransactionList({ rows }: { rows: CorrectableRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [bucket, setBucket] = useState<BucketKey | null>(null);
  const [second, setSecond] = useState<string | null>(null);
  // Optimistic overrides: row id -> label shown immediately after saving.
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function openPicker(rowId: string) {
    setOpenId(openId === rowId ? null : rowId);
    setBucket(null);
    setSecond(null);
    setError(null);
  }

  function save(row: CorrectableRow) {
    if (!bucket) return;
    const input: CorrectionInput =
      bucket === "TRANSFER"
        ? { markAsTransfer: true }
        : {
            cspBucket: bucket,
            moneyDial: bucket === "GUILT_FREE" ? second : null,
            fixedCostCategory: bucket === "FIXED_COSTS" ? second : null,
          };

    // Optimistic: reflect the Correction immediately, then persist and
    // refresh the server-rendered groupings.
    setSaved((prev) => ({ ...prev, [row.id]: optionLabel(bucket, second) }));
    setOpenId(null);
    startTransition(async () => {
      const result = await correctTransaction(row.id, input);
      if (result.error) {
        setSaved((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      {error && (
        <p role="alert" className="text-sm text-error font-sans py-2">
          {error}
        </p>
      )}
      <ul className="divide-y divide-bg-secondary">
        {rows.map((row) => (
          <li key={row.id} className="py-2.5">
            <button
              type="button"
              onClick={() => openPicker(row.id)}
              className="flex w-full items-center justify-between gap-3 text-left"
              aria-expanded={openId === row.id}
            >
              <div className="min-w-0">
                <p className="font-sans text-sm text-text-primary truncate">
                  {row.description}
                </p>
                <p className="text-xs text-text-secondary font-sans">
                  {saved[row.id] ? (
                    <span className="text-accent-gold">
                      {saved[row.id]} — saved, rule created
                    </span>
                  ) : (
                    row.metaLabel
                  )}
                </p>
              </div>
              <span className="font-sans text-sm font-semibold text-text-primary shrink-0">
                {row.amountLabel}
              </span>
            </button>

            {openId === row.id && (
              <div className="mt-2 rounded-md border border-bg-secondary bg-bg-primary p-3 space-y-2.5">
                <p className="text-xs font-sans text-text-secondary">
                  Correct this — it becomes a standing rule for this
                  merchant.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {BUCKET_OPTIONS.map((option) => (
                    <Chip
                      key={option.key}
                      active={bucket === option.key}
                      onClick={() => {
                        setBucket(option.key);
                        setSecond(null);
                      }}
                    >
                      {option.label}
                    </Chip>
                  ))}
                  {!row.isTransfer && (
                    <Chip
                      active={bucket === "TRANSFER"}
                      onClick={() => {
                        setBucket("TRANSFER");
                        setSecond(null);
                      }}
                    >
                      Transfer between your accounts
                    </Chip>
                  )}
                </div>

                {bucket === "GUILT_FREE" && (
                  <div className="flex flex-wrap gap-1.5">
                    {MONEY_DIALS.map((dial) => (
                      <Chip
                        key={dial.category}
                        active={second === dial.category}
                        onClick={() => setSecond(dial.category)}
                      >
                        {dial.name}
                      </Chip>
                    ))}
                  </div>
                )}
                {bucket === "FIXED_COSTS" && (
                  <div className="flex flex-wrap gap-1.5">
                    {FIXED_COST_CATEGORIES.map((category) => (
                      <Chip
                        key={category.key}
                        active={second === category.key}
                        onClick={() => setSecond(category.key)}
                      >
                        {category.label}
                      </Chip>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpenId(null)}
                    className="px-3 py-1.5 rounded-md text-xs font-sans text-text-secondary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => save(row)}
                    disabled={!bucket}
                    className="px-3 py-1.5 rounded-md text-xs font-sans font-medium bg-accent-gold text-white disabled:opacity-40"
                  >
                    Save correction
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
