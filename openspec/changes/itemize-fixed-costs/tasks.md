## 1. Data model & migration

- [ ] 1.1 Add `FixedCostCategory` enum (`HOUSING`, `INSURANCE`, `UTILITIES`, `TRANSPORTATION`, `SUBSCRIPTIONS`, `DEBT_MINIMUMS`, `OTHER`) to `prisma/schema.prisma`
- [ ] 1.2 Add `FixedCostLineItem` model to `prisma/schema.prisma` with fields `id`, `spendingPlanId`, `category`, `name`, `monthlyAmount` (`Decimal(10,2)`), `note?`, `sortOrder`, `createdAt`, `updatedAt`, index on `spendingPlanId`, cascade delete from `SpendingPlan`
- [ ] 1.3 Add `fixedCostLineItems FixedCostLineItem[]` relation to the `SpendingPlan` model
- [ ] 1.4 Run `npx prisma migrate dev --name add_fixed_cost_line_items` and commit the generated migration
- [ ] 1.5 Verify `prisma generate` output in `postinstall` and that the build still succeeds (`npm run build`)

## 2. Types & constants

- [ ] 2.1 In `src/lib/constants/csp-ranges.ts`, export a `FIXED_COST_CATEGORIES` array with `{ key, label, hint }` for each enum value, ordered by commonness (Housing first, Other last)
- [ ] 2.2 Export `FIXED_COSTS_RECOMMENDED_MIN = 50` and `FIXED_COSTS_RECOMMENDED_MAX = 60` constants (or confirm they already exist in `csp-ranges.ts`)
- [ ] 2.3 Add a `FixedCostLineItem` TypeScript type in `src/lib/store/flow-store.ts` matching the design doc shape (`id`, `category`, `name`, `monthlyAmount: number`, `note?`, `sortOrder`)

## 3. Zustand store extensions

- [ ] 3.1 Extend `SpendingPlanData` in `src/lib/store/flow-store.ts` with `fixedCostLineItems: FixedCostLineItem[]` and `fixedCostsOverridden: boolean`, defaulting to `[]` and `false`
- [ ] 3.2 Add selector `getFixedCostsTotalMonthly()` returning `sum(fixedCostLineItems.monthlyAmount)`
- [ ] 3.3 Add selector `getSuggestedFixedCostsPercent()` returning `round(total / getTotalMonthlyIncome() * 100)`, clamped to 0 when income is 0
- [ ] 3.4 Add selector `getRemainingDiscretionaryMonthly()` returning `totalMonthlyIncome - fixedCostsTotalMonthly`
- [ ] 3.5 Implement actions: `addFixedCostLineItem`, `updateFixedCostLineItem`, `removeFixedCostLineItem`, `reorderFixedCostLineItems`, `setFixedCostsOverridden`
- [ ] 3.6 After any line-item mutation, if `fixedCostsOverridden === false`, update `fixedCostsPercent` to the fresh suggested value
- [ ] 3.7 Update the Zustand `persist` config so `fixedCostLineItems` and `fixedCostsOverridden` are included in the persisted `rich-life-flow` localStorage slice

## 4. Server actions & persistence hook

- [ ] 4.1 Add `persistFixedCostLineItems(spendingPlanId, items)` server action in `src/app/actions/flow-persistence.ts` that runs `prisma.$transaction([deleteMany, createMany])` to replace child rows atomically
- [ ] 4.2 Extend `persistSpendingPlan` (or add a companion call) so that when the spending plan is upserted for a profile, the line-item replace action runs with the current store state
- [ ] 4.3 Extend `src/lib/hooks/useFlowPersistence.ts` to subscribe to `fixedCostLineItems` and debounce its flush at the existing 500ms interval
- [ ] 4.4 Surface save failures as a non-blocking toast (matching existing toast patterns in the flow) and log the error

## 5. Fixed Costs flow step UI

- [ ] 5.1 Insert `{ path: "/flow/fixed-costs", label: "Fixed Costs" }` into `FLOW_STEPS` in `src/types/flow.ts` between Financial Picture and Spending Plan; update any index-based logic
- [ ] 5.2 Update `ProgressBar` labels in `src/app/flow/layout.tsx` if they're hardcoded, or confirm they read from `FLOW_STEPS`
- [ ] 5.3 Create `src/app/flow/fixed-costs/page.tsx` with: heading + subtext explaining why, a list of current line items grouped by category, an add/edit form with category chip selector, name field, amount field (numeric, max 99999.99), optional note field, validation errors inline, and a Reality Check summary card
- [ ] 5.4 Add a `FixedCostLineItemList` component with row actions (edit, remove, drag-to-reorder)
- [ ] 5.5 Add a `FixedCostForm` component that handles both add and edit modes, with the validation described in spec Requirement "Add, edit, remove, and reorder fixed-cost line items"
- [ ] 5.6 Add a `RealityCheckCard` component showing total income, total fixed, remaining discretionary, derived %, and an on-target / high / low indicator based on the 50–60% band
- [ ] 5.7 Wire Back/Next buttons to navigate to `/flow/financial-picture` and `/flow/spending-plan` respectively; Next is always enabled (users can skip)

## 6. Spending Plan page updates

- [ ] 6.1 In `src/app/flow/spending-plan/page.tsx`, read `suggestedFixedCostsPercent` and `fixedCostsOverridden` from the store
- [ ] 6.2 On first mount, if `fixedCostsOverridden === false`, set `fixedCostsPercent` to the suggested value
- [ ] 6.3 When the user drags the Fixed Costs slider, call `setFixedCostsOverridden(true)` and stop auto-syncing
- [ ] 6.4 Show a "Derived: X% — Reset to suggested" affordance next to the Fixed Costs slider when `fixedCostsOverridden === true` and the current value differs from the suggested value
- [ ] 6.5 Reuse `RealityCheckCard` on this page (single source of truth for the summary content)
- [ ] 6.6 Replace the existing under/over indicator with a prominent warning banner when `total !== 100`, showing both the % delta and the $ delta, and keep `Next` disabled (existing behavior)
- [ ] 6.7 Keep the existing "Balance Remaining" button but relabel it "Balance remaining across flexible buckets" and confirm it only touches Savings / Investments / Guilt-Free

## 7. Signup migration

- [ ] 7.1 Locate the localStorage → Prisma migration action invoked on signup (per `openspec/specs/dual-path-persistence/spec.md`)
- [ ] 7.2 After the existing `SpendingPlan` upsert, iterate `fixedCostLineItems` from the localStorage payload and `createMany` them linked to the new `SpendingPlan.id`, assigning fresh `cuid`s
- [ ] 7.3 Confirm localStorage clear logic runs after all migrations succeed, not before

## 8. Tests & verification

- [ ] 8.1 Unit-test the store selectors: `getSuggestedFixedCostsPercent` with zero income, non-zero income, and empty line items
- [ ] 8.2 Unit-test the auto-sync behavior: slider follows suggested when `fixedCostsOverridden === false`, stops following after override, snaps back on `setFixedCostsOverridden(false)`
- [ ] 8.3 Integration-test the Fixed Costs page: add → edit → remove → reorder flow updates the list and the Reality Check card
- [ ] 8.4 Integration-test `/flow/spending-plan`: pre-seeded slider, override affordance, Balance Remaining button, Next button disabled when total ≠ 100
- [ ] 8.5 E2E-test (or manual script) the anonymous → authenticated migration: enter 3 line items as anonymous, sign up, verify DB has 3 rows with matching values and fresh cuids, localStorage cleared
- [ ] 8.6 Manual pass: full flow walkthrough (Money Scripts → Money Type → Financial Picture → Fixed Costs → Spending Plan → Money Dials → Your Plan) on both anonymous and authenticated paths
- [ ] 8.7 Run `npm run lint` and `npm run build` and fix any issues

## 9. Documentation

- [ ] 9.1 Update any flow-overview docs / comments that list the 6 flow steps to reflect the new 7-step order
- [ ] 9.2 If there's an internal README or design doc referencing `fixedCostsPercent` semantics, note the "suggested vs. overridden" behavior
