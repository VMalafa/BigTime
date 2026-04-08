## Context

The Conscious Spending Plan (CSP) flow currently asks users to set four bucket percentages with free sliders on `/flow/spending-plan` (`src/app/flow/spending-plan/page.tsx`). Bucket state lives in a Zustand store (`src/lib/store/flow-store.ts`) as a flat `SpendingPlanData` object with four `*Percent` fields. Anonymous users persist to `localStorage` (key `rich-life-flow`); authenticated users persist to Prisma via debounced server actions (`src/app/actions/flow-persistence.ts:persistSpendingPlan`). The sliders render via `CSPSliders.tsx` → `CSPBucketCard.tsx`, and the page blocks `Next` unless `total === 100`.

Total monthly income is already available via `getTotalMonthlyIncome()` selector, which sums `incomeSources[].monthlyAmount` captured on an earlier `/flow/income` step. No part of the flow currently captures **what** the fixed costs are, only a handwave of **how much** percentage to set aside for them.

The flow order (from `src/types/flow.ts`) is:
1. Money Scripts → 2. Money Type → 3. Financial Picture → 4. Spending Plan → 5. Money Dials → 6. Your Plan

This change adds a step between Financial Picture (3) and Spending Plan (4), shifts subsequent step indices, and introduces a new child entity on `SpendingPlan`.

## Goals / Non-Goals

**Goals:**
- Users see exactly what they're paying each month for non-negotiable obligations, categorized, with a running total in dollars and as a % of income.
- A **suggested** Fixed Costs % is computed from the sum of line items and used to pre-seed the Spending Plan slider, turning the Fixed Costs bucket from a guess into an informed starting point.
- Users retain full control: they can override the suggested % (slider stays editable) and edit/delete/reorder line items at any time.
- The dual-path-persistence contract is preserved: line items sync to localStorage for anonymous users and to Prisma for authenticated users with the same 500ms debounce used for the rest of the plan.
- A "Reality Check" summary shows total income, total itemized fixed cost, remaining discretionary, and whether the derived Fixed Costs % lands inside the 50–60% recommended band.

**Non-Goals:**
- Auto-rebalancing Savings / Investments / Guilt-Free when Fixed Costs changes (explicitly rejected — leave the other buckets alone and warn if total drifts off 100%).
- Importing bills from bank feeds, Plaid, or any third party — line items are hand-entered only in this change.
- Tracking actual payments or due dates — this is plan-setup data, not an accounts-payable ledger.
- Variable expenses (groceries, gas). Those belong in Guilt-Free Spending and are out of scope.
- Changing the Money Dials step or the four-bucket Ramit model itself.

## Decisions

### Decision 1: Derived-but-editable, not read-only

Compute `suggestedFixedCostsPercent = round(sumLineItems / totalMonthlyIncome * 100)` and **pre-seed** the slider with it the first time the user visits Spending Plan (or whenever line items change and the user hasn't manually overridden). The slider stays editable.

- **Rationale**: The user explicitly wants room to model "what if I cut this bill" or pad for variability. Forcing read-only would frustrate power users and break the existing muscle-memory of dragging the slider.
- **Implementation**: Track `fixedCostsOverridden: boolean` on `SpendingPlanData`. When `false`, the slider value stays in sync with the derived value. When the user drags the slider, flip to `true` and stop overriding. Show a "Derived: 52% — reset to suggested" affordance next to the slider when `fixedCostsOverridden === true` and the stored value differs from the suggested value.
- **Alternatives considered**:
  - *Read-only slider* → rejected per user decision.
  - *Always overwrite user input with derived value* → rejected; destroys user intent.

### Decision 2: Leave other buckets alone; show warning on total ≠ 100%

When the Fixed Costs slider moves (either because the user dragged it or because the suggested value updated), do **not** redistribute the other three buckets. Continue to use the existing "total must equal 100%" guard (`src/app/flow/spending-plan/page.tsx:100`) and surface a prominent warning banner if it drifts.

- **Rationale**: User explicitly chose "leave them alone and show a warning." Auto-redistribution hides the trade-off the user is supposed to be making.
- **Implementation**: Extend the existing balance indicator. When `totalPercent !== 100`, show a banner with the over/under amount in both % and $, plus a one-tap "Balance remaining across Savings / Investments / Guilt-Free" button (keeping the existing `Balance Remaining` behavior from `spending-plan/page.tsx:38–64` but making it explicit and optional rather than implicit).

### Decision 3: New flow step at index 4 (`/flow/fixed-costs`)

Insert a new step between Financial Picture and Spending Plan.

- **Rationale**: User explicitly chose a dedicated step. This also fits the existing pattern — each CSP input has its own page rather than being an inline expandable section.
- **Implementation**:
  - Extend `FLOW_STEPS` in `src/types/flow.ts` to insert `{ path: "/flow/fixed-costs", label: "Fixed Costs", index: 4 }` and shift Spending Plan → 5, Money Dials → 6, Your Plan → 7.
  - Create `src/app/flow/fixed-costs/page.tsx` with a list + add/edit form, category chips, a "Reality Check" summary card, and Back/Next buttons.
  - Update `ProgressBar` labels; no layout changes.
- **Alternatives considered**:
  - *Inline section on Spending Plan page* → rejected per user decision; also makes the page crowded and muddies the mental model of "capture facts, then make decisions."

### Decision 4: Data model — new `FixedCostLineItem` child table

```prisma
model FixedCostLineItem {
  id             String                @id @default(cuid())
  spendingPlanId String
  spendingPlan   SpendingPlan          @relation(fields: [spendingPlanId], references: [id], onDelete: Cascade)
  category       FixedCostCategory
  name           String
  monthlyAmount  Decimal               @db.Decimal(10, 2)
  note           String?
  sortOrder      Int                   @default(0)
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt

  @@index([spendingPlanId])
}

enum FixedCostCategory {
  HOUSING
  INSURANCE
  UTILITIES
  TRANSPORTATION
  SUBSCRIPTIONS
  DEBT_MINIMUMS
  OTHER
}
```

- **Rationale**: Follows the existing `IncomeSource` / `DebtEntry` pattern in `prisma/schema.prisma`. `Decimal(10,2)` matches `IncomeSource.monthlyAmount`. Cascade delete ensures cleanup when a profile is deleted. `sortOrder` lets users reorder; `note` is for things like "rent, split with roommate." `FixedCostCategory` enum keeps reporting consistent and avoids free-text category drift.
- **Alternatives considered**:
  - *JSON column on `SpendingPlan`* → rejected; harder to query for the combined-household-view aggregation and breaks the existing relational style.
  - *String category* → rejected; free-text categories would make the "Reality Check" grouping unreliable.

### Decision 5: Zustand store shape

Extend `SpendingPlanData` with:

```ts
type FixedCostLineItem = {
  id: string;              // nanoid for localStorage, replaced with DB cuid on persist
  category: FixedCostCategory;
  name: string;
  monthlyAmount: number;   // store as number in client state; convert to Decimal on persist
  note?: string;
  sortOrder: number;
};

type SpendingPlanData = {
  // existing
  fixedCostsPercent: number;
  savingsPercent: number;
  investmentsPercent: number;
  guiltFreePercent: number;
  // new
  fixedCostLineItems: FixedCostLineItem[];
  fixedCostsOverridden: boolean;
};
```

Add selectors:
- `getFixedCostsTotalMonthly()` → `sum(fixedCostLineItems.monthlyAmount)`
- `getSuggestedFixedCostsPercent()` → `round(total / getTotalMonthlyIncome() * 100)` (returns 0 if income is 0)
- `getRemainingDiscretionary()` → `totalMonthlyIncome - fixedCostsTotal`

Add actions:
- `addFixedCostLineItem(item)`
- `updateFixedCostLineItem(id, patch)`
- `removeFixedCostLineItem(id)`
- `reorderFixedCostLineItems(orderedIds)`
- `setFixedCostsOverridden(flag)` — called internally when the slider is dragged on Spending Plan

After any mutation to `fixedCostLineItems`, if `fixedCostsOverridden === false`, also update `fixedCostsPercent` to the fresh suggested value.

### Decision 6: Persistence — one-shot upsert per line-item mutation

Follow the existing `useFlowPersistence.ts` debounce pattern. Add a `persistFixedCostLineItems(spendingPlanId, items)` server action that does a delete-and-reinsert of the child rows inside a single `$transaction`. Why delete-and-reinsert:

- **Rationale**: Line items are small (typically 5–20 rows), the spending plan is per-profile singleton, and debounced re-upserts make diffing server-side brittle. A transactional replace is dead simple and guarantees the DB matches the store on every debounced flush.
- **Alternatives considered**:
  - *Per-row upsert with stable IDs* → more code, more round trips, higher risk of partial updates.
  - *Separate create/update/delete actions* → adds optimistic-update complexity without clear benefit at this scale.

For anonymous users, `fixedCostLineItems` flows through the existing Zustand `persist` middleware to the `rich-life-flow` localStorage key automatically — no new code needed.

### Decision 7: Auto-include debt minimum payments in Fixed Costs totals

The Debts step already captures each debt's `minimumPayment`. The Fixed Costs bucket's suggested percentage and dollar total SHALL fold in `sum(debts[].minimumPayment)` automatically, without duplicating debt data as `FixedCostLineItem` rows.

- **Rationale**: Users told us directly that debt minimums should count without re-entry. Forcing them to type "$325 credit card minimum" twice (once on Debts, once on Fixed Costs) is a double-entry bug waiting to happen — and the data is already in the store. Treating debts as a second input to the derivation keeps the Debts step as the single source of truth for debts, while the Fixed Costs step stays focused on the non-debt obligations (rent, insurance, utilities, subscriptions).
- **Implementation**:
  - New store selectors: `getDebtMinimumsTotal()`, `getFixedCostsLineItemsTotal()`, and the existing `getFixedCostsTotalMonthly()` / `getSuggestedFixedCostsPercent()` / `getRemainingDiscretionaryMonthly()` are updated to sum `lineItems + debtMinimums`.
  - `computeSuggestedPercent(plan, totalIncome, debtMinimumsTotal)` takes the debt total as a third argument.
  - `syncSuggestedPercent` is called from `addDebt` / `updateDebt` / `removeDebt` in addition to the three line-item actions, so mutating debts after the plan is set still updates the slider (unless the user has overridden it).
  - `RealityCheckCard` gains optional `lineItemsTotal` and `debtMinimumsTotal` props; when both are provided and debt minimums > 0, it renders a small "$X line items + $Y debt minimums" sub-line under "Total fixed commitments."
  - The Fixed Costs page renders an "Included automatically" card above the manual line-item list when `debtMinimumsTotal > 0`, showing the amount and a note to edit on the Debts step. This prevents users from adding manual Debt-Minimum line items that would double-count.
- **Alternatives considered**:
  - *Auto-generate FixedCostLineItem rows from debts* → rejected; creates two sources of truth (what if the user removes a debt? what if they edit the auto-generated row?) and double-counts if the sync drifts.
  - *Only show debt minimums in the Reality Check, not on the form* → rejected; the "Included automatically" card makes the behavior discoverable at the moment the user is about to re-enter the same data, which is exactly when the reminder matters most.

### Decision 8: Migration on signup

The existing localStorage-to-DB migration action (invoked on signup per the dual-path-persistence spec) must learn to carry `fixedCostLineItems` along. After the existing `SpendingPlan` upsert, iterate `fixedCostLineItems` from the payload and insert them with a fresh `cuid` for each row.

## Risks / Trade-offs

- **[Risk] Existing users with saved plans hit a migration mid-flow.** → Mitigation: the new Prisma migration is additive (new table, no changes to `SpendingPlan` columns), so existing `SpendingPlan` rows stay valid and simply have zero `fixedCostLineItems`. The Zustand store default value is `[]`, and all selectors degrade gracefully (`getSuggestedFixedCostsPercent()` returns 0 → no slider change).
- **[Risk] Debounced replace-in-transaction could race with another tab writing the same profile.** → Mitigation: same risk as every other persisted slice today (the existing `persistSpendingPlan` already has this). Acceptable for v1; revisit if we ever add multi-tab sync.
- **[Risk] Users enter huge `Decimal(10,2)` values that overflow.** → Mitigation: client-side input validation caps monthly amount at $99,999.99 per line (well below `Decimal(10,2)` max) and the form rejects non-numeric input.
- **[Risk] Categorization drift: users stuff everything into OTHER.** → Mitigation: show a friendly hint on the page ("Most users split these into 3–4 categories") and order the category chips by commonness. This is a UX concern, not a data one.
- **[Trade-off] Suggested-vs-override UX adds state complexity.** The `fixedCostsOverridden` flag is a subtle piece of state. If we later decide to always-force or always-leave-alone, we can drop it. For now, it's the minimum that honors the user's "keep editable" requirement without making the suggested value feel useless.
- **[Trade-off] No auto-rebalance means new users who crank Fixed Costs from 50% → 67% will see a 17% overage warning.** That's by design — it's the signal. But the "Balance remaining" button stays available as an escape hatch.

## Migration Plan

1. **Add Prisma model + enum + migration** (`prisma/schema.prisma`, `prisma migrate dev --name add_fixed_cost_line_items`).
2. **Run `prisma generate`** (already in `postinstall`).
3. **Deploy schema change** before the app code that writes to it (standard Vercel deployment — the migration runs first).
4. **Ship app code** in one PR since the new table is additive and the store default is `[]`. No feature-flag required.
5. **Rollback**: if the new step regresses, revert the app PR; the `FixedCostLineItem` table can stay (inert) to avoid rolling back the migration. If a full rollback is needed, `prisma migrate resolve` + `drop table` as a follow-up — no existing data depends on it.
