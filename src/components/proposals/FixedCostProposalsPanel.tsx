"use client";

import { useEffect, useState, useTransition } from "react";
import {
  confirmFixedCostProposals,
  dismissProposal,
  getFlowProposals,
} from "@/app/actions/proposals";
import type { FixedCostProposal } from "@/lib/proposals/proposals";
import { FIXED_COST_CATEGORIES } from "@/lib/constants/csp-ranges";
import { useFlowStore } from "@/lib/store/flow-store";
import { generateId } from "@/lib/utils/validation";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";

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
  const addFixedCostLineItem = useFlowStore((s) => s.addFixedCostLineItem);
  const lineItemCount = useFlowStore(
    (s) => s.spendingPlan?.fixedCostLineItems.length ?? 0
  );
  const [confirmAll, setConfirmAll] = useState<FixedCostProposal[]>([]);
  const [individual, setIndividual] = useState<FixedCostProposal[]>([]);
  const [loaded, setLoaded] = useState(false);
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
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || (confirmAll.length === 0 && individual.length === 0)) {
    return null;
  }

  function addToPlan(proposals: FixedCostProposal[]) {
    proposals.forEach((proposal, index) => {
      addFixedCostLineItem({
        id: generateId(),
        category: proposal.fixedCostCategory as never,
        name: proposal.name,
        monthlyAmount: proposal.monthlyAmountCents / 100,
        note: "From your linked accounts",
        sortOrder: lineItemCount + index,
      });
    });
    startTransition(async () => {
      await confirmFixedCostProposals(
        proposals.map((p) => ({
          merchantPattern: p.merchantPattern,
          fixedCostCategory: p.fixedCostCategory,
        }))
      );
    });
  }

  function handleConfirmAll() {
    const batch = confirmAll;
    setConfirmAll([]);
    addToPlan(batch);
  }

  function handleConfirmOne(proposal: FixedCostProposal) {
    setIndividual((prev) =>
      prev.filter((p) => p.merchantPattern !== proposal.merchantPattern)
    );
    addToPlan([proposal]);
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
