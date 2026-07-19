// The One Flow (#73, ratified in #26): a thin guided walk over the
// canonical pages — never parallel page copies. Pure derivation: the walk
// has no stored step pointer; it reads what the household's data already
// proves. Exit condition — "setup complete" = Safe-to-Spend computable:
// income present + CSP at 100% (a saved plan validates to 100) + Money
// Dials named. Linking, the fixed-cost/debt ratify pass, and the wire-up
// checklist guide but never gate; manual is the fallback, never a fork.

export interface SetupInputs {
  hasLinkedAccount: boolean;
  /** IncomeSource rows or a CONFIRMED INCOME Proposal decision. */
  hasIncome: boolean;
  /** A saved Conscious Spending Plan (validation holds it at 100%). */
  hasPlan: boolean;
  /** At least one Money Dial deliberately saved. */
  hasNamedDials: boolean;
  /** Any fixed-cost line item or Debt on file (the ratify pass's trace). */
  hasCostsOrDebts: boolean;
  /** Every automation checklist item done. */
  automationDone: boolean;
}

export type SetupStepKey =
  | "LINK"
  | "INCOME"
  | "COSTS_DEBTS"
  | "PLAN"
  | "WIRE_UP";

export interface SetupStep {
  key: SetupStepKey;
  label: string;
  /** The canonical page the walk points at. */
  href: string;
  done: boolean;
  /** Skippable steps guide but never gate completion. */
  optional: boolean;
}

export interface SetupWalkState {
  /** Safe-to-Spend computable — the walk retires. */
  complete: boolean;
  steps: SetupStep[];
  /** The first not-done gating step, else the first not-done optional. */
  next: SetupStep | null;
}

export function deriveSetupWalk(inputs: SetupInputs): SetupWalkState {
  const steps: SetupStep[] = [
    {
      key: "LINK",
      label: "Link accounts",
      href: "/settings/connections",
      done: inputs.hasLinkedAccount,
      optional: true,
    },
    {
      key: "INCOME",
      label: "Income",
      href: "/dashboard/income",
      done: inputs.hasIncome,
      optional: false,
    },
    {
      key: "COSTS_DEBTS",
      label: "Fixed costs & debts",
      href: "/dashboard/fixed-costs",
      done: inputs.hasCostsOrDebts,
      optional: true,
    },
    {
      key: "PLAN",
      label: "Plan & Dials",
      href: "/dashboard/spending-plan",
      done: inputs.hasPlan && inputs.hasNamedDials,
      optional: false,
    },
    {
      key: "WIRE_UP",
      label: "Wire it up",
      href: "/dashboard/automation",
      done: inputs.automationDone,
      optional: true,
    },
  ];

  const complete = inputs.hasIncome && inputs.hasPlan && inputs.hasNamedDials;

  // The walk's finger: gating gaps first (they end setup), then the first
  // skippable gap in journey order.
  const next =
    steps.find((s) => !s.done && !s.optional) ??
    steps.find((s) => !s.done) ??
    null;

  return { complete, steps, next };
}

/**
 * The Plan step's inner pointer: CSP first, then Dials — one canonical
 * page each, walked in order.
 */
export function planStepHref(inputs: {
  hasPlan: boolean;
  hasNamedDials: boolean;
}): string {
  return inputs.hasPlan ? "/dashboard/money-dials" : "/dashboard/spending-plan";
}
