# Rich Life

A household financial wellness app: it turns linked bank data and a Conscious Spending Plan into encouragement and plain-language context for people who would rather not stare at the numbers.

## Language

### Household & people

**Household**:
The single account (one login) shared by the people building a financial life together. All data belongs to a Household.
_Avoid_: Team, family, couple account

**Profile**:
One person within a Household (Netflix-style). Personal financial facts (debts, income, money psychology) hang off a Profile.
_Avoid_: User (reserved for the login identity), persona

### Aggregation

**Linked Account**:
A real-world bank, credit-card, or loan account connected read-only through the aggregator. The app holds only a revocable access token for it — never credentials.
_Avoid_: Connection, bank account (ambiguous with the manual Debt/IncomeSource records)

**Transaction**:
A single dated money movement reported by a Linked Account's feed.
_Avoid_: Entry, item

**Mapping**:
The association between a Linked Account and a manual record (e.g., a Debt). Once mapped, the feed owns the balance; rarely-changing facts (APR, minimum payment, credit limit) stay manual.
_Avoid_: Sync, merge

**Categorization**:
The two-level label on a Transaction: first a CSP bucket (Fixed Costs, Savings, Investments, Guilt-Free); then, within Guilt-Free, one Money Dial — or, within Fixed Costs, one fixed-cost category. The app never invents a third taxonomy; transactions speak the same language as the plan.
_Avoid_: Tags, merchant category, budget category

**Correction**:
A household member reassigning a Transaction's Categorization. A Correction is never a one-off: it becomes a standing rule for that merchant, so the same mistake is never made twice.
_Avoid_: Recategorize, override

**Proposal**:
A feed-derived draft entry (income source, fixed-cost line item, debt) awaiting ratification — never plan data until confirmed. Clear-cut Proposals are bundled into a single confirm-all; only ambiguous or plan-moving ones (income always; odd cadences; outsized amounts) ask for individual attention. The feed drafts, the human ratifies — and effort is spent only where being wrong would matter.
_Avoid_: Suggestion (too weak), auto-import

**Transfer**:
Money moving between the household's own Linked Accounts — a credit-card payment from checking, a savings sweep. Detected as an opposite-amount pair and excluded from both spending and income. Card purchases are spending at the merchant when they happen; paying the card later is just a Transfer.
_Avoid_: Payment (ambiguous), internal transaction

### Rhythm

**Pay Period**:
The span between one detected paycheck deposit (either partner's) and the next. One household heartbeat with one shared Safe-to-Spend; periods vary in length when two pay schedules interleave. Pay Periods power the live heartbeat (Safe-to-Spend, Earmarks) only; reflective views of past spending (Dial Drift, "where did it go") run on calendar months.
_Avoid_: Budget cycle, sprint

**Earmark**:
A fixed cost whose due date falls inside a Pay Period, reserved against that period's paycheck before anything is spendable.
_Avoid_: Reservation, hold

**Safe-to-Spend**:
The single leading number: the current Pay Period's paycheck minus its Earmarks and planned savings/investments. What's genuinely free until the next check.
_Avoid_: Remaining budget, disposable income

**Bonus Plan**:
The household's standing, pre-committed split for windfalls (e.g., 70% target debt / 15% savings / 15% guilt-free), decided calmly in advance.
_Avoid_: Windfall rule, allocation policy

**Bonus Moment**:
The one-confirm prompt raised when the feed detects a non-paycheck windfall: the Bonus Plan applied to real dollars, with concrete payoff impact shown. Bonus deposits never inflate Safe-to-Spend.
_Avoid_: Bonus alert, notification

### Goals & motivation

**Goal**:
A named fund tied to a linked savings account — "Hawaii, June 2027" — with a target amount and date. The far-future house is just a dormant Goal.
_Avoid_: Dream, wishlist item, home goal

**Spotlight Goal**:
The single Goal currently given home-screen billing and a fixed slice of the plan. One at a time, by design.
_Avoid_: Primary goal, pinned goal

**Money Date**:
The payday-timed, ten-minute shared ritual: weather recap, one insight, one next action, Spotlight Goal progress — always ending on the goal. Distinct from the deeper monthly check-in.
_Avoid_: Digest (the digest is the artifact; the Money Date is the ritual), review meeting

**Milestone**:
A celebration event — each $1,000 of debt gone, a card paid off, each 10% of a Goal funded — prompting a real-life celebration budgeted from guilt-free spending.
_Avoid_: Achievement, badge

**Readiness Panel**:
Plain-language view of the lender-relevant dials — debt-to-income, utilization trend, score checkpoints — each with its threshold and the single action that moves it. Ships with the house Goal, far future.
_Avoid_: Mortgage calculator

### Insight & tone

**Household Weather**:
The single glanceable home state: **Steady**, **Watch**, or **Attention**. Always paired with one plain-language sentence and, when non-Steady, exactly one next action.
_Avoid_: Status, health score (that's the Wholeness Score)

**Honesty Rule**:
Encouragement comes from framing and next actions, never from hiding or softening the true state. The app may say "fixable, here's how"; it may never say "fine" when it isn't.

**Dial Drift**:
A mismatch between a Money Dial's stated importance and its actual share of guilt-free spending — the core "patterns → optimal outcomes" insight.
_Avoid_: Overspending (shame word), variance

### Plan

**Conscious Spending Plan (CSP)**:
The four-bucket allocation of income — Fixed Costs, Savings, Investments, Guilt-Free Spending — expressed as percentages that must total 100.
_Avoid_: Budget (the app's philosophy is a plan, not a restriction)

**Debt**:
A manually-curated liability record (balance, APR, minimum payment). May be mapped to a Linked Account, in which case the feed owns its balance.
_Avoid_: Loan, liability
