## ADDED Requirements

### Requirement: Dedicated Fixed Costs step before Spending Plan
The flow SHALL include a dedicated step at `/flow/fixed-costs`, positioned between "Financial Picture" and "Spending Plan", where users enter itemized monthly fixed-cost obligations before allocating bucket percentages. The step SHALL be reflected in the `FLOW_STEPS` sequence, progress bar, and back/next navigation.

#### Scenario: User advances from Financial Picture to Fixed Costs
- **WHEN** an authenticated or anonymous user on `/flow/financial-picture` taps "Next"
- **THEN** they are routed to `/flow/fixed-costs` and the progress bar shows the new step as active

#### Scenario: User advances from Fixed Costs to Spending Plan
- **WHEN** a user completes (or skips) the Fixed Costs step and taps "Next"
- **THEN** they are routed to `/flow/spending-plan` with any entered line items already persisted to the store

### Requirement: Add, edit, remove, and reorder fixed-cost line items
The system SHALL allow users to add, edit, remove, and reorder fixed-cost line items. Each line item SHALL have a `name`, `monthlyAmount`, `category` (one of `HOUSING`, `INSURANCE`, `UTILITIES`, `TRANSPORTATION`, `SUBSCRIPTIONS`, `DEBT_MINIMUMS`, `OTHER`), an optional `note`, and a `sortOrder`. Monthly amount input SHALL be validated as a non-negative number and SHALL not exceed $99,999.99 per line.

#### Scenario: User adds a line item
- **WHEN** a user enters name "Mortgage", category "Housing", and amount "2450", then taps "Add"
- **THEN** the item appears in the list with the provided values and the running total updates to include it

#### Scenario: User edits an existing line item
- **WHEN** a user taps "Edit" on an existing line item and changes the amount from 120 to 140
- **THEN** the stored amount updates to 140 and the running total recalculates immediately

#### Scenario: User removes a line item
- **WHEN** a user taps "Remove" on an existing line item and confirms
- **THEN** the item is deleted from the list and the running total recalculates

#### Scenario: User enters an invalid amount
- **WHEN** a user enters a negative number, non-numeric text, or an amount greater than 99999.99
- **THEN** the form surfaces a validation error and the item is not added

#### Scenario: User reorders line items
- **WHEN** a user drags a line item to a new position in the list
- **THEN** the `sortOrder` field of each affected item updates and the list persists in the new order

### Requirement: Derived suggested Fixed Costs percentage
The system SHALL compute a suggested Fixed Costs percentage as `round((sum(fixedCostLineItems.monthlyAmount) + sum(debts[].minimumPayment)) / totalMonthlyIncome * 100)`. Minimum debt payments captured on the Debts step SHALL be automatically included in the numerator so users never need to re-enter them as line items. When `totalMonthlyIncome` is 0, the suggested percentage SHALL be 0. The suggested value SHALL be exposed as a store selector and recomputed whenever line items, debts, or income change.

#### Scenario: User has line items totaling 3500 against 7000 income
- **WHEN** the user has entered line items summing to $3,500, no debts, and a total monthly income of $7,000
- **THEN** the suggested Fixed Costs percentage is 50

#### Scenario: User has line items and debt minimums
- **WHEN** the user has entered line items summing to $3,000, debts with combined minimum payments of $500, and a total monthly income of $7,000
- **THEN** the suggested Fixed Costs percentage is 50 (computed from $3,500 / $7,000)

#### Scenario: User has debt minimums but no manual line items yet
- **WHEN** the user arrives on the Fixed Costs step after adding debts totaling $500/mo in minimums, with $7,000 total monthly income, and has not yet added any line items
- **THEN** the suggested Fixed Costs percentage is 7 and the Reality Check shows $500 already counted toward fixed commitments

#### Scenario: User removes a debt after the plan is set
- **WHEN** the user returns to the Debts step and removes a debt with a $200 minimum payment, while the Fixed Costs slider has not been manually overridden
- **THEN** the suggested Fixed Costs percentage recomputes immediately and the Spending Plan slider reflects the new (lower) value

#### Scenario: User has line items but no income yet
- **WHEN** the user has entered line items but total monthly income is 0
- **THEN** the suggested Fixed Costs percentage is 0 and the UI explains that income is required to compute a percentage

### Requirement: Automatic inclusion of debt minimum payments
The Fixed Costs step SHALL surface the sum of all debt minimum payments (captured on the Debts step) as a separate "Included automatically" summary above the manual line-item list, so users can see the number without re-entering it. The summary SHALL hide when there are no debts. Debt minimum payments SHALL NOT be added as `FixedCostLineItem` rows — the Debts step remains the single source of truth for debt data.

#### Scenario: User with debts lands on Fixed Costs step
- **WHEN** a user who previously entered three debts with a combined $650/mo in minimum payments lands on `/flow/fixed-costs`
- **THEN** an "Included automatically" card at the top of the page shows "$650/mo" and a note that the amounts come from the Debts step

#### Scenario: User with no debts lands on Fixed Costs step
- **WHEN** a user with zero debts lands on `/flow/fixed-costs`
- **THEN** the "Included automatically" card is not rendered

#### Scenario: Reality Check breakdown when debt minimums are present
- **WHEN** the Fixed Costs page renders for a user with $2,000 in line items and $500 in debt minimums
- **THEN** the Reality Check card shows total fixed commitments of $2,500 with a breakdown line "$2,000 line items + $500 debt minimums"

### Requirement: Pre-seed Spending Plan slider with suggested value
When the user first lands on `/flow/spending-plan` after entering line items, the Fixed Costs slider SHALL be pre-seeded with the suggested value. The slider SHALL remain editable. Subsequent changes to line items SHALL continue to update the slider ONLY while the user has not manually overridden it.

#### Scenario: Fresh visit to Spending Plan after adding line items
- **WHEN** a user adds line items summing to $3,500 on $7,000 income, then navigates to `/flow/spending-plan`
- **THEN** the Fixed Costs slider shows 50% and `fixedCostsOverridden` is false

#### Scenario: User edits line items without overriding the slider
- **WHEN** a user returns to `/flow/fixed-costs`, adds a new $200 line item, and returns to `/flow/spending-plan` without touching the slider
- **THEN** the slider automatically updates to the new suggested value (53% in this example)

#### Scenario: User overrides the slider then edits line items
- **WHEN** a user drags the Fixed Costs slider from 50% to 45%, then returns to `/flow/fixed-costs` and adds a new $200 line item
- **THEN** the slider stays at 45% and a "Derived: 53% — reset to suggested" affordance appears next to the slider

#### Scenario: User taps "Reset to suggested"
- **WHEN** a user who has overridden the slider taps "Reset to suggested"
- **THEN** the slider snaps back to the current suggested value and `fixedCostsOverridden` becomes false

### Requirement: Do not auto-rebalance other buckets
When the Fixed Costs percentage changes (either from a line-item update or a manual slider drag), the system SHALL NOT automatically modify `savingsPercent`, `investmentsPercent`, or `guiltFreePercent`. If the sum of all four percentages is not exactly 100, the system SHALL display a warning banner showing the over/under amount in both percentage and dollars, and SHALL block the user from advancing to the next step until the total equals 100.

#### Scenario: Fixed Costs slider moves above current allocation
- **WHEN** the user drags Fixed Costs from 50% to 60% while Savings/Investments/Guilt-Free remain at 5/5/20 (total 90+15=105... → 10% over)
- **THEN** Savings, Investments, and Guilt-Free percentages are unchanged and a warning banner reads "Over by 10% ($700)"

#### Scenario: User taps "Balance remaining"
- **WHEN** the total is not 100 and the user taps "Balance remaining"
- **THEN** the system distributes the over/under delta proportionally across Savings, Investments, and Guilt-Free, bringing the total to exactly 100

#### Scenario: User tries to advance with unbalanced plan
- **WHEN** the total bucket percentage is not 100 and the user taps "Next"
- **THEN** the navigation is blocked and the warning banner stays visible

### Requirement: Reality Check summary
Both `/flow/fixed-costs` and `/flow/spending-plan` SHALL display a Reality Check summary showing: total monthly income, total itemized fixed-cost dollars, remaining discretionary dollars (income minus fixed costs), derived Fixed Costs percentage, and whether the derived percentage is inside Ramit Sethi's recommended 50–60% band. Out-of-band values SHALL show inline guidance explaining the implication.

#### Scenario: Derived percentage inside recommended band
- **WHEN** the derived Fixed Costs percentage is 55%
- **THEN** the Reality Check shows a green "On target (50–60%)" indicator

#### Scenario: Derived percentage above recommended band
- **WHEN** the derived Fixed Costs percentage is 72%
- **THEN** the Reality Check shows an amber "High fixed costs (above 60%)" indicator with guidance suggesting the user review the largest line items

#### Scenario: Derived percentage below recommended band
- **WHEN** the derived Fixed Costs percentage is 38%
- **THEN** the Reality Check shows a neutral "Low fixed costs (below 50%)" indicator noting that the user may have unlisted obligations

### Requirement: Persist line items using the dual-path pattern
The system SHALL persist `fixedCostLineItems` following the existing dual-path-persistence pattern: anonymous users via Zustand `persist` to the `rich-life-flow` localStorage key, and authenticated users via a debounced server action that replaces the `FixedCostLineItem` rows for the active profile's `SpendingPlan` inside a single database transaction. The debounce interval SHALL match the existing 500ms used by `persistSpendingPlan`.

#### Scenario: Anonymous user adds a line item
- **WHEN** an anonymous user adds a line item on `/flow/fixed-costs`
- **THEN** the item is written to localStorage under the `rich-life-flow` key

#### Scenario: Authenticated user adds a line item
- **WHEN** an authenticated user adds a line item
- **THEN** within 500ms a server action runs that replaces the profile's `FixedCostLineItem` rows to match the current store state

#### Scenario: Server action fails during debounced flush
- **WHEN** the server action throws (e.g., DB connectivity)
- **THEN** the local store keeps the current line items and the user sees a non-blocking toast indicating save failed, with the next debounced flush retrying

### Requirement: Migrate localStorage line items on signup
The localStorage-to-DB migration that runs on signup (per the `dual-path-persistence` capability) SHALL also migrate `fixedCostLineItems`. For each item in localStorage, a new `FixedCostLineItem` row SHALL be inserted linked to the new profile's `SpendingPlan`, with a server-generated `cuid` replacing the client-side id.

#### Scenario: Anonymous user with line items signs up
- **WHEN** an anonymous user who has added 6 fixed-cost line items signs up
- **THEN** the new profile's `SpendingPlan` has exactly 6 `FixedCostLineItem` rows with the same category/name/amount/note/sortOrder values, each assigned a fresh cuid

#### Scenario: Anonymous user with no line items signs up
- **WHEN** an anonymous user with no line items signs up
- **THEN** the new profile's `SpendingPlan` is created normally with zero `FixedCostLineItem` rows
