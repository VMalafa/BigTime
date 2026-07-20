"use client";

import { useEffect, useState, useTransition } from "react";
import {
  confirmIncomeProposal,
  dismissProposal,
  getFlowProposals,
  type ConfirmedIncomeSource,
} from "@/app/actions/proposals";
import type { IncomeProposal } from "@/lib/proposals/proposals";
import { incomeCache, type IncomeState } from "@/lib/hooks/useIncomeData";
import { runOptimistic } from "@/lib/hooks/entity-cache";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";

// Income Proposals (CONTEXT.md): paycheck-like deposit streams the feed
// detected. Income ALWAYS sits in the individual-attention tier — it moves
// every CSP percentage — so there is no confirm-all here by design. Each
// card shows the deposit-stream evidence and the derived monthly amount.

const CADENCE_LABELS: Record<string, string> = {
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  SEMI_MONTHLY: "semi-monthly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  ANNUAL: "annual",
};

export function IncomeProposalsPanel() {
  const [proposals, setProposals] = useState<IncomeProposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    getFlowProposals()
      .then((result) => {
        if (result.linked) setProposals(result.income);
      })
      // Honesty Rule (#109): a failed Proposal load says so instead of
      // silently rendering nothing.
      .catch(() =>
        setLoadError(
          "Couldn't check your linked accounts for income — reload to try again."
        )
      );
  }, []);

  if (proposals.length === 0) {
    return loadError ? (
      <p role="alert" className="text-xs font-sans text-warning">
        {loadError}
      </p>
    ) : null;
  }

  function handleConfirm(proposal: IncomeProposal) {
    setError(null);
    // Optimistic: the card leaves and the income appears immediately; the
    // awaited action (#49) writes the IncomeSource row server-side, and a
    // failure rolls both back (the shared runOptimistic shape, #109).
    setProposals((prev) =>
      prev.filter((p) => p.merchantPattern !== proposal.merchantPattern)
    );
    const tempId = `pending-${proposal.merchantPattern}`;
    startTransition(async () => {
      await runOptimistic<IncomeState, ConfirmedIncomeSource>({
        cache: incomeCache,
        optimistic: (s) => ({
          ...s,
          incomeSources: [
            ...s.incomeSources,
            {
              id: tempId,
              name: proposal.name,
              monthlyAmount: proposal.monthlyAmountCents / 100,
              isAfterTax: true,
            },
          ],
        }),
        action: async () => {
          const result = await confirmIncomeProposal(proposal.merchantPattern);
          const confirmed = result.incomeSource;
          return result.error || !confirmed
            ? { error: result.error ?? "Could not confirm income. Try again." }
            : { value: confirmed };
        },
        // Swap the optimistic row for the stable server row.
        confirm: (s, confirmed) => ({
          ...s,
          incomeSources: s.incomeSources.map((i) =>
            i.id === tempId ? confirmed : i
          ),
        }),
        onError: (message) => {
          setProposals((prev) => [...prev, proposal]);
          setError(message);
        },
      });
    });
  }

  function handleDismiss(proposal: IncomeProposal) {
    setProposals((prev) =>
      prev.filter((p) => p.merchantPattern !== proposal.merchantPattern)
    );
    startTransition(async () => {
      await dismissProposal("INCOME", proposal.merchantPattern);
    });
  }

  return (
    <div className="rounded-lg border border-accent-gold/50 bg-accent-gold/5 p-5 space-y-4">
      <div>
        <h3 className="font-serif text-lg text-text-primary">
          Income found in your linked accounts
        </h3>
        <p className="text-xs text-text-secondary font-sans">
          Paycheck-like deposit streams from your feed. Income moves every
          percentage in your plan, so each one asks for your direct
          confirmation — never bundled.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 font-sans">
          {error}
        </p>
      )}

      {proposals.map((proposal) => (
        <div
          key={proposal.merchantPattern}
          className="rounded-md bg-white border border-bg-secondary p-4 space-y-3"
        >
          <div>
            <p className="font-sans text-sm font-medium text-text-primary">
              {proposal.name}
            </p>
            <p className="text-xs text-text-secondary font-sans">
              {formatCurrency(proposal.typicalAmountCents / 100)}{" "}
              {CADENCE_LABELS[proposal.cadence]} ·{" "}
              <span className="font-medium text-text-primary">
                {formatCurrency(proposal.monthlyAmountCents / 100)}/mo
              </span>{" "}
              derived monthly
            </p>
          </div>

          <div>
            <p className="text-xs font-sans font-medium text-text-secondary mb-1">
              Deposit evidence ({proposal.occurrences} seen)
            </p>
            <ul className="space-y-0.5">
              {proposal.evidence.map((item) => (
                <li
                  key={item.postedAt.toISOString()}
                  className="text-xs font-sans text-text-secondary"
                >
                  {item.postedAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}{" "}
                  · {formatCurrency(item.amountCents / 100)}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleConfirm(proposal)}
            >
              Confirm income
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDismiss(proposal)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
