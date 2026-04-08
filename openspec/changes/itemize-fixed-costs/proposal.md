## Why

Today the Spending Plan tab asks users to pick a Fixed Costs percentage with a free slider (0–100), with no way to tell whether 50% of their income actually covers their real monthly obligations. Two users with identical incomes can end up on wildly different plans just because one guessed high and the other guessed low. Ramit Sethi's system is supposed to give users clarity on what's locked in vs. what's discretionary, but without line-item input for the non-negotiable bills (mortgage/rent, insurance, utilities, subscriptions, minimum debt payments), the Fixed Costs bucket is a vibe check, not a number. We need to turn Fixed Costs into a derived value so the remaining Savings / Investments / Guilt-Free buckets reflect what's genuinely available.

## What Changes

- Add a new dedicated flow step, `/flow/fixed-costs`, inserted between "Financial Picture" and "Spending Plan", where users add line items: name, category (Housing, Insurance, Utilities, Transportation, Subscriptions, Debt Minimums, Other), and monthly amount.
- Compute a **suggested** `fixedCostsPercent` and `fixedCostsMonthly` automatically from `sum(lineItems) / totalMonthlyIncome`. When the user lands on the Spending Plan page, the Fixed Costs slider is pre-seeded to the derived value.
- The Fixed Costs slider **remains fully editable** — users can override the derived value (e.g., to model cutting a bill or padding for variability). When override differs from the derived value, show a subtle "Derived from line items: X% — tap to reset" affordance.
- **Do not auto-reallocate** Savings / Investments / Guilt-Free when Fixed Costs changes. Leave the other three buckets alone and show a clear warning banner if the total drifts off 100% (over or under), matching the existing "can't proceed unless sum = 100%" guard.
- Surface a "Reality Check" summary on both the Fixed Costs step and the Spending Plan step showing: total income, total fixed commitments, remaining discretionary dollars, and whether Fixed Costs falls inside/outside Ramit's 50–60% recommended range — with inline guidance if out of range.
- Persist line items alongside the existing `SpendingPlan` record via the dual-path-persistence pattern (Zustand → localStorage for anonymous, debounced server action → Prisma for authenticated).
- Extend `SpendingPlan` with a child `FixedCostLineItem` relation. `fixedCostsPercent` retains its existing meaning (user-chosen bucket allocation); a new `derivedFixedCostsMonthly` computation lives in the store as a selector.

## Capabilities

### New Capabilities

- `itemized-fixed-costs`: Capture per-line fixed cost entries, derive the Fixed Costs bucket from them, and drive automatic reallocation across the remaining flexible buckets so the Conscious Spending Plan always balances to 100% without manual fiddling.

### Modified Capabilities

<!-- None. The four existing specs (combined-household-view, dual-path-persistence, household-auth, profile-management) do not define requirements on CSP bucket math. The dual-path-persistence patterns will be followed by the new capability but its requirements are unchanged. -->

## Impact

- **UI**: `src/app/flow/spending-plan/page.tsx`, `src/components/flow/CSPSliders.tsx`, `src/components/flow/CSPBucketCard.tsx`, and a new line-item entry component. New step or section added to the flow (`src/types/flow.ts`, `src/app/flow/layout.tsx`).
- **State**: `src/lib/store/flow-store.ts` — extend `SpendingPlanData` with `fixedCostLineItems`, add selectors for derived percent/dollars, and a reallocation helper for the flexible buckets.
- **Persistence**: `src/app/actions/flow-persistence.ts` and `src/lib/hooks/useFlowPersistence.ts` — persist line items; debounced upsert following the dual-path-persistence pattern.
- **Database**: `prisma/schema.prisma` — new `FixedCostLineItem` model with FK to `SpendingPlan`; migration required. `SpendingPlan.fixedCostsPercent` keeps its existing semantics (user-editable allocation).
- **Constants**: `src/lib/constants/csp-ranges.ts` — add fixed-cost category enum and labels.
- **No impact** on household-auth, profile-management, combined-household-view spec requirements (combined-household-view will naturally pick up the new line items when aggregating, but its spec requirements don't need to change).
