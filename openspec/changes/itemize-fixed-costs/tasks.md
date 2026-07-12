## 1. Data model & migration

- [x] 1.1 Add `FixedCostCategory` enum (`HOUSING`, `INSURANCE`, `UTILITIES`, `TRANSPORTATION`, `SUBSCRIPTIONS`, `DEBT_MINIMUMS`, `OTHER`) to `prisma/schema.prisma`
- [x] 1.2 Add `FixedCostLineItem` model to `prisma/schema.prisma` with fields `id`, `spendingPlanId`, `category`, `name`, `monthlyAmount` (`Decimal(10,2)`), `note?`, `sortOrder`, `createdAt`, `updatedAt`, index on `spendingPlanId`, cascade delete from `SpendingPlan`
- [x] 1.3 Add `fixedCostLineItems FixedCostLineItem[]` relation to the `SpendingPlan` model. Also added `fixedCostsOverridden Boolean @default(false)` so the override flag survives DB hydration (refinement uncovered during implementation — without it, logged-in users would lose their override state between sessions).
- [x] 1.4 ~~Run `npx prisma migrate dev --name add_fixed_cost_line_items` and commit the generated migration~~ — **N/A for this project**: the repo has no `prisma/migrations/` folder and `package.json`'s build script only runs `prisma generate && next build`, so the project does not use Prisma Migrate. Schema changes are applied out-of-band (Supabase dashboard / `db push`). Schema is validated via `npx prisma validate` and the generated client compiles cleanly; the reference DDL (from `prisma migrate diff`) was spot-checked for correctness.
- [x] 1.5 Verified `prisma generate` output in `postinstall` and that `npm run build` succeeds with `/flow/fixed-costs` in the route manifest.

## 2. Types & constants

- [x] 2.1 In `src/lib/constants/csp-ranges.ts`, export a `FIXED_COST_CATEGORIES` array with `{ key, label, hint }` for each enum value, ordered by commonness (Housing first, Other last)
- [x] 2.2 Export `FIXED_COSTS_RECOMMENDED_MIN = 50` and `FIXED_COSTS_RECOMMENDED_MAX = 60` constants (derived from the existing `CSP_RANGES.fixedCosts.min/max` so there's one source of truth)
- [x] 2.3 Add a `FixedCostLineItem` TypeScript type in `src/lib/store/flow-store.ts` matching the design doc shape (`id`, `category`, `name`, `monthlyAmount: number`, `note?`, `sortOrder`). The `FixedCostCategory` union is exported from `csp-ranges.ts` and imported into the store to keep constants and types aligned.

## 3. Zustand store extensions

- [x] 3.1 Extend `SpendingPlanData` in `src/lib/store/flow-store.ts` with `fixedCostLineItems: FixedCostLineItem[]` and `fixedCostsOverridden: boolean`. Added a `normalizeSpendingPlan` helper and `onRehydrateStorage` callback so older persisted plans from localStorage are backfilled with empty line items / `false` override on load.
- [x] 3.2 Add selector `getFixedCostsTotalMonthly()` returning `sum(fixedCostLineItems.monthlyAmount)`
- [x] 3.3 Add selector `getSuggestedFixedCostsPercent()` returning `round(total / getTotalMonthlyIncome() * 100)`, clamped to 0 when income is 0
- [x] 3.4 Add selector `getRemainingDiscretionaryMonthly()` returning `totalMonthlyIncome - fixedCostsTotalMonthly`
- [x] 3.5 Implement actions: `addFixedCostLineItem`, `updateFixedCostLineItem`, `removeFixedCostLineItem`, `reorderFixedCostLineItems`, `setFixedCostsOverridden`
- [x] 3.6 After any line-item mutation, if `fixedCostsOverridden === false`, update `fixedCostsPercent` to the fresh suggested value (via `syncSuggestedPercent` helper)
- [x] 3.7 The Zustand `persist` config already uses `partialize` that excludes only `_isAuthenticated` / `_isHydrated`, so new `spendingPlan` fields flow into localStorage automatically. Confirmed by inspection.

## 4. Server actions & persistence hook

- [x] 4.1 Added `persistFixedCostLineItemsForPlan(spendingPlanId, items)` helper (plus a public `persistFixedCostLineItems(items)` wrapper) in `src/app/actions/flow-persistence.ts` that runs `prisma.$transaction([deleteMany, createMany])` to replace child rows atomically
- [x] 4.2 `persistSpendingPlan` now upserts the plan and immediately calls the transactional replace with the current store line items. `loadProfileFlowData` eager-loads `fixedCostLineItems` ordered by `sortOrder` and returns them alongside the plan.
- [x] 4.3 `useFlowPersistence` already subscribes to the full `spendingPlan` object in its debounced-flush state key, so line-item edits flow through the existing 500ms debounce without hook changes. Added a clarifying comment explaining the coupling.
- [x] 4.4 Save failures continue to use the existing `console.error("Failed to persist flow data to DB:", err)` pattern. Deviation from tasks.md: the project has no toast infrastructure (no `react-hot-toast`, `sonner`, etc.), so introducing one would be out of scope. The existing error surface is preserved.

## 5. Fixed Costs flow step UI

- [x] 5.1 Inserted `{ id: 3, path: "/flow/fixed-costs", label: "Fixed Costs", description: "List your non-negotiable monthly bills" }` into `FLOW_STEPS` in `src/types/flow.ts`. Shifted Spending Plan → id 4, Money Dials → id 5, Your Plan → id 6. Incidentally, this makes the pre-existing `setCurrentStep` values in income/spending-plan/money-dials pages internally consistent (they previously assumed a 7-step implicit flow).
- [x] 5.2 `ProgressBar` reads labels from `FLOW_STEPS.map(s => s.label)` and length from `FLOW_STEPS.length` in `src/app/flow/layout.tsx`, so no changes needed — it picks up the 7-step array automatically.
- [x] 5.3 Created `src/app/flow/fixed-costs/page.tsx` with heading + subtext, add/edit form, grouped line-item list, Reality Check summary card, and Back/Next navigation.
- [x] 5.4 Created `src/components/flow/FixedCostLineItemList.tsx`. Items are grouped by category (each group shows a subtotal), with per-row Edit/Remove actions and ↑/↓ buttons for reordering. Drag-and-drop was replaced with keyboard-friendly arrow buttons — simpler, works on touch, no new dependency.
- [x] 5.5 Created `src/components/flow/FixedCostForm.tsx` handling both add and edit modes. Validation matches the spec: required name, non-negative numeric amount, `FIXED_COST_MAX_AMOUNT` (99,999.99) cap. The form is remounted via `key={editing?.id ?? "new"}` when switching modes, avoiding a setState-in-effect pattern that React 19 flags as a lint error.
- [x] 5.6 Created `src/components/flow/RealityCheckCard.tsx` showing total income, total fixed, remaining discretionary, derived %, and an on-target / high / low / no-income band indicator with guidance copy.
- [x] 5.7 Back goes to `/flow/income` (the prior page), Next goes to `/flow/spending-plan`. Next is always enabled; its label is "Skip for now" when there are zero line items and "Continue" otherwise. (Note: the spec and tasks used "Financial Picture" as the back target, but the actual prior page in the existing flow is `/flow/income` — staying consistent with the real routing.)

## 6. Spending Plan page updates

- [x] 6.1 `src/app/flow/spending-plan/page.tsx` now pulls `suggestedFixedCostsPercent` (via `getSuggestedFixedCostsPercent`), `totalFixedCosts` (via `getFixedCostsTotalMonthly`), and the `fixedCostsOverridden` flag from the store.
- [x] 6.2 On first mount, if `fixedCostsOverridden === false` and a suggested value exists, local `values.fixedCostsPercent` is pre-seeded to the suggested value.
- [x] 6.3 `handleValuesChange` detects slider drags on Fixed Costs and calls `setFixedCostsOverridden(true)` to freeze the auto-sync. The "adjust state during render" pattern (tracking `lastSeenSuggested` in local state) keeps the slider synced with line-item edits until the user overrides — without using a setState-in-effect.
- [x] 6.4 When `fixedCostsOverridden === true` and the current value differs from the suggested one, a "Derived from your line items: X% — Reset to suggested" affordance renders above the sliders with a ghost button that calls `handleResetToSuggested`.
- [x] 6.5 `RealityCheckCard` is rendered at the top of the Spending Plan page with the same props as on the Fixed Costs page — single source of truth for the summary content.
- [x] 6.6 Replaced the existing balance button + inline under/over indicator with a prominent warning banner (red when over, amber when under) that shows the delta in both % and $, plus the guidance copy. Next button stays disabled until `total === 100` via the existing `nextDisabled` prop.
- [x] 6.7 The balance button now reads "Balance remaining across flexible buckets" and its `handleBalance` implementation leaves `fixedCostsPercent` untouched, distributing the over/under delta proportionally across Savings / Investments / Guilt-Free (with Guilt-Free absorbing any rounding remainder).

## 7. Signup migration

- [x] 7.1 Located the migration action at `src/app/actions/migrate-flow.ts` (invoked via the `useMigrateLocalData` hook wired into `FlowLayout`).
- [x] 7.2 Extended the `spendingPlan` branch of `migrateFlowData` to accept `fixedCostsOverridden` and a `fixedCostLineItems` array. After creating the `SpendingPlan` row, line items are inserted via `createMany` with server-generated cuids, a cast through `FixedCostCategory`, and default `sortOrder` fallback.
- [x] 7.3 Confirmed: `useMigrateLocalData` only removes the localStorage key after `migrateFlowData` resolves with `success: true`. On failure the raw state stays on disk.

## 8. Tests & verification

- [ ] 8.1 ~~Unit-test the store selectors~~ — **Deferred: no test framework.** The project has no Vitest/Jest/Playwright configuration, no test scripts in `package.json`, and zero existing `*.test.*` files. Setting one up is out of scope for this change. Adding this back belongs in a dedicated "add test infra" change.
- [ ] 8.2 ~~Unit-test the auto-sync behavior~~ — **Deferred** (same reason as 8.1).
- [ ] 8.3 ~~Integration-test the Fixed Costs page~~ — **Deferred** (same reason as 8.1).
- [ ] 8.4 ~~Integration-test `/flow/spending-plan`~~ — **Deferred** (same reason as 8.1).
- [ ] 8.5 ~~E2E-test the anonymous → authenticated migration~~ — **Deferred** (same reason as 8.1).
- [ ] 8.6 Manual full-flow walkthrough — **Partially complete (2026-07-11)**: schema pushed to Supabase via `prisma db push` (added `directUrl`/`DIRECT_URL` for the session pooler, `?pgbouncer=true` on the runtime `DATABASE_URL`), `npm run build` passes, dev server serves `/flow/fixed-costs` (HTTP 200), and Prisma queries the new `FixedCostLineItem` table against the live DB. Remaining: interactive browser click-through of the full flow (income → fixed costs → spending plan → signup migration) by the repo owner.
- [x] 8.7 Ran `npm run lint` (fixed 2 new lint errors I introduced: `setState` in `useEffect` in `FixedCostForm` → replaced with a `key`-based remount; same pattern in spending-plan page → replaced with the "adjust state during render" pattern). Ran `npm run build` — compiles cleanly, `/flow/fixed-costs` appears in the route manifest, Prisma client regenerates. Fixed one secondary type error where widening `keyof SpendingPlanData` broke `CSPSliders` / `CSPOverview` / `dashboard.defaultPlan`; narrowed the bucket-key types to `SpendingPlanPercentField`/`Key` and added the two new fields to `defaultPlan`.

## 9. Documentation

- [x] 9.1 Searched the repo for "6 flow steps", "six-step", and similar phrases — no hits. The only source-of-truth for the step count is `FLOW_STEPS` itself, which is now authoritative. Nothing else to update.
- [x] 9.2 Searched the repo for internal README/design docs referencing `fixedCostsPercent` — only the existing `csp-ranges.ts` (updated) and `proposal.md` / `design.md` / `spec.md` / `tasks.md` in this change itself (which already document the new "suggested vs. overridden" behavior). README.md is the Next.js boilerplate and has no flow references.
