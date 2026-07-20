"use client";

import { useEffect, useState, useTransition } from "react";
import {
  confirmFixedCostProposals,
  dismissProposal,
  getFlowProposals,
} from "@/app/actions/proposals";
import type { FixedCostProposal } from "@/lib/proposals/proposals";
import { FIXED_COST_CATEGORIES } from "@/lib/constants/csp-ranges";
import { planCache } from "@/lib/hooks/useSpendingPlan";
import { runOptimistic } from "@/lib/hooks/entity-cache";
import { generateId } from "@/lib/utils/validation";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";

// Server-authoritative (#50): confirmation creates the FixedCostLineItem
// rows server-side from feed-derived facts; the optimistic store add below
// is only the instant mirror, replaced by the returned plan (stable ids)
// or rolled back on failure.

// Fixed-cost Proposals (CONTEXT.md): the feed drafts, the human ratifies.
// Clear-cut Proposals bundle under one confirm-all (list visible);
// ambiguous or plan-moving ones ask individually. Nothing enters the plan
// unconfirmed; a dismissal is remembered.

const CATEGORY_LABELS = new Map(
  FIXED_COST_CATEGORIES.map((c) => [c.key as string, c.label])
);

const CADENCE_LABELS: Record<string, string> = {
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  SEMI_MONTHLY: "semi-monthly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  ANNUAL: "annual",
};

function proposalLine(proposal: FixedCostProposal): string {
  const cadence =
    proposal.cadence === "MONTHLY"
      ? ""
      : ` (${CADENCE_LABELS[proposal.cadence]} → monthly equivalent)`;
  return `${formatCurrency(proposal.monthlyAmountCents / 100)}/mo${cadence} · ${
    CATEGORY_LABELS.get(proposal.fixedCostCategory) ?? proposal.fixedCostCategory
  }`;
}

export function FixedCostProposalsPanel() {
  const lineItemCount =
    planCache.use()?.fixedCostLineItems.length ?? 0;
  const [confirmAll, setConfirmAll] = useState<FixedCostProposal[]>([]);
  const [individual, setIndividual] = useState<FixedCostProposal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    getFlowProposals()
      .then((proposals) => {
        if (proposals.linked) {
          setConfirmAll(proposals.fixedCosts.confirmAll);
          setIndividual(proposals.fixedCosts.individual);
        }
        setLoaded(true);
      })
      // Honesty Rule (#109): a failed Proposal load says so instead of
      // silently rendering nothing.
      .catch(() => {
        setLoadError(
          "Couldn't check your linked accounts for fixed costs — reload to try again."
        );
        setLoaded(true);
      });
  }, []);

  if (!loaded || (confirmAll.length === 0 && individual.length === 0)) {
    return loaded && loadError ? (
      <p role="alert" className="text-xs font-sans text-warning">
        {loadError}
      </p>
    ) : null;
  }

  function addToPlan(
    proposals: FixedCostProposal[],
    restoreCards: () => void
  ) {
    setError(null);
    startTransition(async () => {
      // The shared runOptimistic shape (#109): optimistic rows in, rolled
      // back on failure, swapped for the server plan on success.
      await runOptimistic({
        cache: planCache,
        optimistic: (plan) => {
          const base = plan ?? {
            fixedCostsPercent: 0,
            savingsPercent: 0,
            investmentsPercent: 0,
            guiltFreePercent: 0,
            fixedCostsOverridden: false,
            fixedCostLineItems: [],
          };
          return {
            ...base,
            fixedCostLineItems: [
              ...base.fixedCostLineItems,
              ...proposals.map((proposal, index) => ({
                id: generateId(),
                category: proposal.fixedCostCategory as never,
                name: proposal.name,
                monthlyAmount: proposal.monthlyAmountCents / 100,
                note: "From your linked accounts",
                sortOrder: lineItemCount + index,
              })),
            ],
          };
        },
        action: async () => {
          const result = await confirmFixedCostProposals(
            proposals.map((p) => p.merchantPattern)
          );
          return result.error
            ? { error: result.error }
            : { value: result.plan ?? null };
        },
        // Swap the optimistic rows for the server plan — stable ids.
        confirm: (plan, serverPlan) => serverPlan ?? plan,
        onError: (message) => {
          restoreCards();
          setError(message);
        },
      });
    });
  }

  function handleConfirmAll() {
    const batch = confirmAll;
    setConfirmAll([]);
    addToPlan(batch, () => setConfirmAll(batch));
  }

  function handleConfirmOne(proposal: FixedCostProposal) {
    setIndividual((prev) =>
      prev.filter((p) => p.merchantPattern !== proposal.merchantPattern)
    );
    addToPlan([proposal], () =>
      setIndividual((prev) => [...prev, proposal])
    );
  }

  function handleDismiss(proposal: FixedCostProposal, tier: "all" | "one") {
    if (tier === "all") {
      setConfirmAll((prev) =>
        prev.filter((p) => p.merchantPattern !== proposal.merchantPattern)
      );
    } else {
      setIndividual((prev) =>
        prev.filter((p) => p.merchantPattern !== proposal.merchantPattern)
      );
    }
    startTransition(async () => {
      await dismissProposal("FIXED_COST", proposal.merchantPattern);
    });
  }

  return (
    <div className="rounded-lg border border-accent-gold/50 bg-accent-gold/5 p-5 space-y-5">
      <div>
        <h3 className="font-serif text-lg text-text-primary">
          Proposals from your linked accounts
        </h3>
        <p className="text-xs text-text-secondary font-sans">
          Drafted from recurring charges in your feed. Nothing enters your
          plan until you confirm it.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 font-sans">
          {error}
        </p>
      )}

      {confirmAll.length > 0 && (
        <div>
          <ul className="divide-y divide-bg-secondary rounded-md bg-white border border-bg-secondary px-4">
            {confirmAll.map((proposal) => (
              <li
                key={proposal.merchantPattern}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-sans text-sm text-text-primary truncate">
                    {proposal.name}
                  </p>
                  <p className="text-xs text-text-secondary font-sans">
                    {proposalLine(proposal)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDismiss(proposal, "all")}
                  className="text-xs font-sans text-text-secondary hover:text-text-primary shrink-0"
                >
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button variant="primary" size="md" onClick={handleConfirmAll}>
              Confirm all {confirmAll.length}
            </Button>
          </div>
        </div>
      )}

      {individual.map((proposal) => (
        <div
          key={proposal.merchantPattern}
          className="rounded-md bg-white border border-bg-secondary p-4"
        >
          <p className="font-sans text-sm font-medium text-text-primary">
            {proposal.name}
          </p>
          <p className="text-xs text-text-secondary font-sans">
            {proposalLine(proposal)}
          </p>
          <p className="text-xs text-warning font-sans mt-1">
            {proposal.individualReason}
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleConfirmOne(proposal)}
            >
              Confirm
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDismiss(proposal, "one")}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
