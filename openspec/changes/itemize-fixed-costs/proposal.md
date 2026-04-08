## Why

Today the Spending Plan tab asks users to pick a Fixed Costs percentage with a free slider (0–100), with no way to tell whether 50% of their income actually covers their real monthly obligations. Two users with identical incomes can end up on wildly different plans just because one guessed high and the other guessed low. Ramit Sethi's system is supposed to give users clarity on what's locked in vs. what's discretionary, but without line-item input for the non-negotiable bills (mortgage/rent, insurance, utilities, subscriptions, minimum debt payments), the Fixed Costs bucket is a vibe check, not a number. We need to turn Fixed Costs into a derived value so the remaining Savings / Investments / Guilt-Free buckets reflect what's genuinely available.

## What Changes

- Add a new "Fixed Costs" step (or expanded section) where users add line items: name, category (Housing, Insurance, Utilities, Transportation, Subscriptions, Debt Minimums, Other), and monthly amount.
- Compute `fixedCostsPercent` and `fixedCostsMonthly` automatically from `sum(lineItems) / totalMonthlyIncome`. The Fixed Costs slider becomes read-only/derived on the Spending Plan screen.
- When the derived Fixed Costs % changes, automatically reallocate the remaining percentage across Savings / Investments / Guilt-Free, preserving each flexible bucket's relative weight (so users never see "total ≠ 100%").
- Surface a "Reality Check" summary on the Spending Plan screen showing: total income, total fixed commitments, remaining discretionary dollars, and whether Fixed Costs falls inside/outside Ramit's 50–60% recommended range — with inline guidance if out of range.
- Rethink the tab flow so users add fixed-cost line items **before** they land on the bucket sliders, and persist line items alongside the existing `SpendingPlan` record.
- **BREAKING** (data model): `SpendingPlan` gains a child `FixedCostLineItem` relation; `fixedCostsPercent` becomes a *computed* value stored for snapshot/history but no longer user-editable via the slider.

## Capabilities

### New Capabilities

- `itemized-fixed-costs`: Capture per-line fixed cost entries, derive the Fixed Costs bucket from them, and drive automatic reallocation across the remaining flexible buckets so the Conscious Spending Plan always balances to 100% without manual fiddling.

### Modified Capabilities

<!-- None. The four existing specs (combined-household-view, dual-path-persistence, household-auth, profile-management) do not define requirements on CSP bucket math. The dual-path-persistence patterns will be followed by the new capability but its requirements are unchanged. -->

## Impact

- **UI**: `src/app/flow/spending-plan/page.tsx`, `src/components/flow/CSPSliders.tsx`, `src/components/flow/CSPBucketCard.tsx`, and a new line-item entry component. New step or section added to the flow (`src/types/flow.ts`, `src/app/flow/layout.tsx`).
- **State**: `src/lib/store/flow-store.ts` — extend `SpendingPlanData` with `fixedCostLineItems`, add selectors for derived percent/dollars, and a reallocation helper for the flexible buckets.
- **Persistence**: `src/app/actions/flow-persistence.ts` and `src/lib/hooks/useFlowPersistence.ts` — persist line items; debounced upsert following the dual-path-persistence pattern.
- **Database**: `prisma/schema.prisma` — new `FixedCostLineItem` model with FK to `SpendingPlan`; migration required. `SpendingPlan.fixedCostsPercent` semantics change from user-input to derived snapshot.
- **Constants**: `src/lib/constants/csp-ranges.ts` — add fixed-cost category enum and labels.
- **No impact** on household-auth, profile-management, combined-household-view spec requirements (combined-household-view will naturally pick up the new line items when aggregating, but its spec requirements don't need to change).
