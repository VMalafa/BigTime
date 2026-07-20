"use client";

import { useEffect, useState, useTransition } from "react";
import {
  confirmDebtProposal,
  dismissProposal,
  getFlowProposals,
} from "@/app/actions/proposals";
import type { DebtProposal } from "@/lib/proposals/proposals";
import { useDebts } from "@/lib/hooks/useDebts";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// Debt Proposals (CONTEXT.md): unmapped CREDIT_CARD/LOAN Linked Accounts.
// The feed owns the name and balance; only APR and minimum payment need a
// human. Confirming creates the Debt and the Mapping in one step
// server-side; the page then re-reads — no hand-kept store mirror (#51).

export function DebtProposalsPanel() {
  const { refresh } = useDebts();
  const [proposals, setProposals] = useState<DebtProposal[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { apr: string; minimum: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    getFlowProposals()
      .then((result) => {
        if (result.linked) setProposals(result.debts);
      })
      // Honesty Rule (#109): a failed Proposal load says so instead of
      // silently rendering nothing.
      .catch(() =>
        setLoadError(
          "Couldn't check your linked accounts for debts — reload to try again."
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

  function draftFor(id: string) {
    return drafts[id] ?? { apr: "", minimum: "" };
  }

  function handleConfirm(proposal: DebtProposal) {
    const draft = draftFor(proposal.linkedAccountId);
    const apr = Number(draft.apr);
    const minimum = Number(draft.minimum);
    if (!Number.isFinite(apr) || apr < 0 || apr > 100) {
      setErrors((prev) => ({
        ...prev,
        [proposal.linkedAccountId]: "Enter an APR between 0 and 100.",
      }));
      return;
    }
    if (!Number.isFinite(minimum) || minimum < 0 || draft.minimum === "") {
      setErrors((prev) => ({
        ...prev,
        [proposal.linkedAccountId]: "Enter the minimum payment.",
      }));
      return;
    }

    setProposals((prev) =>
      prev.filter((p) => p.linkedAccountId !== proposal.linkedAccountId)
    );
    startTransition(async () => {
      const result = await confirmDebtProposal({
        linkedAccountId: proposal.linkedAccountId,
        apr,
        minimumPaymentCents: Math.round(minimum * 100),
      });
      if (result.debt) {
        // The Debt + Mapping were written server-side; re-read the one
        // source instead of mirroring by hand.
        await refresh();
      } else if (result.error) {
        setProposals((prev) => [proposal, ...prev]);
        setErrors((prev) => ({
          ...prev,
          [proposal.linkedAccountId]: result.error ?? "Something went wrong.",
        }));
      }
    });
  }

  function handleDismiss(proposal: DebtProposal) {
    setProposals((prev) =>
      prev.filter((p) => p.linkedAccountId !== proposal.linkedAccountId)
    );
    startTransition(async () => {
      await dismissProposal("DEBT", proposal.linkedAccountId);
    });
  }

  return (
    <div className="rounded-lg border border-accent-gold/50 bg-accent-gold/5 p-5 space-y-4">
      <div>
        <h3 className="font-serif text-lg text-text-primary">
          Debts found in your linked accounts
        </h3>
        <p className="text-xs text-text-secondary font-sans">
          The feed owns the balance — it stays current automatically. Add the
          two facts banks don&apos;t share: APR and minimum payment.
        </p>
      </div>

      {proposals.map((proposal) => (
        <div
          key={proposal.linkedAccountId}
          className="rounded-md bg-white border border-bg-secondary p-4 space-y-3"
        >
          <div>
            <p className="font-sans text-sm font-medium text-text-primary">
              {proposal.name}
            </p>
            <p className="text-xs text-text-secondary font-sans">
              {proposal.institution} · balance{" "}
              {formatCurrency(proposal.balanceCents / 100)} (from the feed)
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="APR (%)"
              type="number"
              min={0}
              max={100}
              step="0.01"
              placeholder="e.g. 24.99"
              value={draftFor(proposal.linkedAccountId).apr}
              onChange={(e) =>
                setDrafts((prev) => ({
                  ...prev,
                  [proposal.linkedAccountId]: {
                    ...draftFor(proposal.linkedAccountId),
                    apr: e.target.value,
                  },
                }))
              }
            />
            <Input
              label="Minimum payment"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={draftFor(proposal.linkedAccountId).minimum}
              onChange={(e) =>
                setDrafts((prev) => ({
                  ...prev,
                  [proposal.linkedAccountId]: {
                    ...draftFor(proposal.linkedAccountId),
                    minimum: e.target.value,
                  },
                }))
              }
            />
          </div>
          {errors[proposal.linkedAccountId] && (
            <p role="alert" className="text-xs text-error font-sans">
              {errors[proposal.linkedAccountId]}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleConfirm(proposal)}
            >
              Confirm Debt
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
