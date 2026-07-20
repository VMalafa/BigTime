"use client";

import { useRef, useState, useTransition } from "react";
import { correctTransaction } from "@/app/actions/corrections";
import { FIXED_COST_CATEGORIES } from "@/lib/constants/csp-ranges";
import { MONEY_DIALS } from "@/lib/constants/money-dials";
import type { CorrectionInput } from "@/lib/categorization/corrections";

// Inline Corrections (CONTEXT.md): tap a transaction, pick the bucket, then
// the Money Dial / fixed-cost category as applicable. Every tap that fully
// specifies a Categorization saves immediately — there is no separate Save
// button to hunt for. Saved optimistically — the row updates in place and
// stays in its section for the rest of the session, so a batch of
// corrections never scrolls out from under the person making them. A failed
// save reopens the row's picker with the error shown at the row itself.

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

// Buckets with a second-level Categorization step; the rest save on first tap.
const TWO_LEVEL_BUCKETS: readonly BucketKey[] = ["GUILT_FREE", "FIXED_COSTS"];

function bucketLabel(bucket: BucketKey): string {
  if (bucket === "TRANSFER") return "Transfer between your accounts";
  return BUCKET_OPTIONS.find((b) => b.key === bucket)?.label ?? bucket;
}

function optionLabel(bucket: BucketKey, second: string | null): string {
  const base = bucketLabel(bucket);
  if (bucket === "GUILT_FREE" && second) {
    return `${base} · ${MONEY_DIALS.find((d) => d.category === second)?.name ?? second}`;
  }
  if (bucket === "FIXED_COSTS" && second) {
    return `${base} · ${FIXED_COST_CATEGORIES.find((c) => c.key === second)?.label ?? second}`;
  }
  return base;
}

// Momentary action, not a toggle: tapping a chip is the save itself.
function Chip({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 px-4 py-2 rounded-full text-sm font-sans border transition-colors bg-white text-text-primary border-bg-secondary hover:border-accent-gold"
    >
      {children}
    </button>
  );
}

export function CorrectableTransactionList({ rows }: { rows: CorrectableRow[] }) {
  const [, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [bucket, setBucket] = useState<BucketKey | null>(null);
  // Optimistic overrides: row id -> label shown immediately after saving.
  const [saved, setSaved] = useState<Record<string, string>>({});
  // Failures stay with their row, not at the top of the list.
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  // Announced to screen readers; visually the row itself shows the outcome.
  const [announcement, setAnnouncement] = useState("");
  const rowButtons = useRef(new Map<string, HTMLButtonElement>());

  function focusRow(rowId: string) {
    rowButtons.current.get(rowId)?.focus();
  }

  function openPicker(rowId: string) {
    setOpenId(openId === rowId ? null : rowId);
    setBucket(null);
    setRowErrors((prev) => {
      if (!(rowId in prev)) return prev;
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }

  function closePicker(rowId: string) {
    setOpenId(null);
    setBucket(null);
    focusRow(rowId);
  }

  // A fully specified choice saves immediately; the picker closes and the
  // row keeps its place in the current grouping until the next visit.
  function save(row: CorrectableRow, chosenBucket: BucketKey, second: string | null) {
    const input: CorrectionInput =
      chosenBucket === "TRANSFER"
        ? { markAsTransfer: true }
        : {
            cspBucket: chosenBucket,
            moneyDial: chosenBucket === "GUILT_FREE" ? second : null,
            fixedCostCategory: chosenBucket === "FIXED_COSTS" ? second : null,
          };

    const label = optionLabel(chosenBucket, second);
    setSaved((prev) => ({ ...prev, [row.id]: label }));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
    closePicker(row.id);
    startTransition(async () => {
      const result = await correctTransaction(row.id, input);
      if (result.error) {
        const message = result.error;
        setSaved((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
        setRowErrors((prev) => ({ ...prev, [row.id]: message }));
        setAnnouncement(`Could not save ${row.description}: ${message}`);
        // Reopen so the retry is one tap away — unless the person has
        // already moved on to another row's picker.
        setOpenId((current) => current ?? row.id);
        return;
      }
      setAnnouncement(`${row.description} saved as ${label}. Rule created.`);
    });
  }

  function pickBucket(row: CorrectableRow, chosen: BucketKey) {
    if (TWO_LEVEL_BUCKETS.includes(chosen)) {
      setBucket(chosen);
      return;
    }
    save(row, chosen, null);
  }

  return (
    <div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <ul className="divide-y divide-bg-secondary">
        {rows.map((row) => (
          <li key={row.id} className="py-2.5">
            <button
              type="button"
              ref={(el) => {
                if (el) rowButtons.current.set(row.id, el);
                else rowButtons.current.delete(row.id);
              }}
              onClick={() => openPicker(row.id)}
              className="flex w-full min-h-11 items-center justify-between gap-3 text-left"
              aria-expanded={openId === row.id}
              aria-controls={`correction-picker-${row.id}`}
            >
              <div className="min-w-0">
                <p className="font-sans text-sm text-text-primary truncate">
                  {row.description}
                </p>
                <p className="text-xs text-text-secondary font-sans">
                  {saved[row.id] ? (
                    <span className="text-accent-gold-deep">
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

            {rowErrors[row.id] && (
              <p role="alert" className="text-sm text-error font-sans mt-1">
                {rowErrors[row.id]} — tap a category to try again.
              </p>
            )}

            {openId === row.id && (
              <div
                id={`correction-picker-${row.id}`}
                className="mt-2 rounded-md border border-bg-secondary bg-bg-primary p-3 space-y-2.5"
              >
                {bucket === null ? (
                  <>
                    <p className="text-xs font-sans text-text-secondary">
                      Tap where this belongs — it becomes a standing rule for
                      this merchant.
                    </p>
                    <div
                      role="group"
                      aria-label="Category"
                      className="flex flex-wrap gap-2"
                    >
                      {BUCKET_OPTIONS.map((option) => (
                        <Chip
                          key={option.key}
                          onClick={() => pickBucket(row, option.key)}
                        >
                          {option.label}
                        </Chip>
                      ))}
                      {!row.isTransfer && (
                        <Chip onClick={() => pickBucket(row, "TRANSFER")}>
                          Transfer between your accounts
                        </Chip>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBucket(null)}
                        className="min-h-11 px-3 py-2 -ml-3 rounded-md text-sm font-sans text-text-secondary hover:text-text-primary"
                      >
                        ‹ Back
                      </button>
                      <p className="text-sm font-sans font-medium text-text-primary">
                        {bucketLabel(bucket)}
                      </p>
                    </div>
                    <div
                      role="group"
                      aria-label={
                        bucket === "GUILT_FREE" ? "Money Dial" : "Fixed cost category"
                      }
                      className="flex flex-wrap gap-2"
                    >
                      {bucket === "GUILT_FREE" &&
                        MONEY_DIALS.map((dial) => (
                          <Chip
                            key={dial.category}
                            onClick={() => save(row, "GUILT_FREE", dial.category)}
                          >
                            {dial.name}
                          </Chip>
                        ))}
                      {bucket === "FIXED_COSTS" &&
                        FIXED_COST_CATEGORIES.map((category) => (
                          <Chip
                            key={category.key}
                            onClick={() => save(row, "FIXED_COSTS", category.key)}
                          >
                            {category.label}
                          </Chip>
                        ))}
                    </div>
                    {bucket === "GUILT_FREE" && (
                      <p className="text-xs font-sans text-text-secondary">
                        Without a dial, Dial Drift can&apos;t count this one.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => save(row, bucket, null)}
                      className="min-h-11 px-3 py-2 -ml-3 rounded-md text-sm font-sans text-text-secondary hover:text-text-primary"
                    >
                      Save as just {bucketLabel(bucket)}
                    </button>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
