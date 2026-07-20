"use client";

// The manual fallback + the one-time migration (#89, per #25). The
// standalone BonusItem entry UI is retired: a bonus the feed missed is
// recorded as the same Bonus Moment the feed would have raised (decided on
// Home, same card, same calm), and each pre-#89 BonusItem row surfaces
// exactly once for bring-it-in-or-let-it-go.

import { useEffect, useState } from "react";
import {
  listLegacyBonusItems,
  recordManualBonus,
  resolveLegacyBonusItem,
  type LegacyBonusItem,
} from "@/app/actions/bonus";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils/format";

export function BonusFallback() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState<LegacyBonusItem[]>([]);

  useEffect(() => {
    listLegacyBonusItems().then(setLegacy);
  }, []);

  async function record() {
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError("Enter the real amount that landed.");
      return;
    }
    setRecording(true);
    setError(null);
    setRecorded(false);
    const result = await recordManualBonus({
      amountCents,
      description,
    });
    setRecording(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAmount("");
    setDescription("");
    setRecorded(true);
  }

  // Optimistic remove + rollback (#29): the row leaves the list the moment
  // it's decided; a failed save puts it back.
  async function resolve(item: LegacyBonusItem, decision: "MIGRATE" | "DISMISS") {
    const previous = legacy;
    setLegacy(previous.filter((l) => l.id !== item.id));
    setError(null);
    let result: { ok?: boolean; error?: string };
    try {
      result = await resolveLegacyBonusItem({ id: item.id, decision });
    } catch {
      result = { error: "That didn't save — try again." };
    }
    if (result.error) {
      setLegacy(previous);
      setError(result.error);
    }
  }

  return (
    <div>
      {legacy.length > 0 && (
        <div
          data-bonus-migration
          className="mb-6 rounded-xl border border-accent-gold/40 bg-accent-gold/5 px-4 py-3"
        >
          <p className="text-sm font-sans text-text-primary">
            Bonuses you&apos;d entered before live differently now — each
            becomes a one-confirm Bonus Moment, or lets go quietly. Once
            decided, they won&apos;t ask again.
          </p>
          <ul className="mt-2 space-y-2">
            {legacy.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 text-sm font-sans"
              >
                <span className="min-w-0 truncate text-text-primary">
                  {item.name}
                  <span className="text-text-secondary text-xs">
                    {" "}
                    · ~{formatCurrency(item.netCents / 100)} net
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => resolve(item, "MIGRATE")}
                    className="min-h-11 rounded-full border border-accent-gold px-3.5 py-1 text-xs text-accent-gold-deep hover:bg-accent-gold/10 transition-colors"
                  >
                    Bring it in
                  </button>
                  <button
                    type="button"
                    onClick={() => resolve(item, "DISMISS")}
                    className="min-h-11 text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Let it go
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div data-bonus-fallback className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-sans text-text-secondary">
            Amount that landed
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="900.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-32 rounded-md border border-bg-secondary px-2 py-1.5 text-sm font-sans text-text-primary"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-sans text-text-secondary sm:flex-none">
            What was it?
            <input
              type="text"
              placeholder="Spot bonus"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full sm:w-44 rounded-md border border-bg-secondary px-2 py-1.5 text-sm font-sans text-text-primary"
            />
          </label>
          <Button
            variant="secondary"
            size="sm"
            disabled={recording}
            onClick={record}
          >
            {recording ? "Raising…" : "Raise the Moment"}
          </Button>
        </div>
        {error && <p className="text-xs font-sans text-error">{error}</p>}
        {recorded && (
          <p className="text-xs font-sans text-success" role="status">
            Raised — decide it together on Home, split and all.
          </p>
        )}
      </div>
    </div>
  );
}
