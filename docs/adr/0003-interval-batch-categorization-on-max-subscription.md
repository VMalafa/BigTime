# Transaction categorization: deterministic in-app, AI in interval batches on the Max subscription

Transactions are categorized into the app's existing vocabularies only (CSP bucket, then Money Dial within Guilt-Free or fixed-cost category within Fixed Costs) — no third taxonomy. The pipeline is layered: (1) deterministic assignment from Mappings and known fixed-cost line items, (2) a per-household rule table, and only then (3) AI for the unmatched residue. The AI layer deliberately does **not** run in the app: uncategorized transactions queue in the database, and a recurring Claude Code job running on the owner's Max subscription categorizes the batch and writes back **rules, not just labels**. Every user Correction also becomes a rule. The app's `ANTHROPIC_API_KEY` is reserved for user-facing features; categorization costs zero API spend, and the deterministic share grows monotonically with every batch run and Correction.

Spending is measured on an accrual view: card purchases count at the merchant when they happen; opposite-amount pairs across the household's own Linked Accounts are detected as Transfers and excluded from both spending and income (prevents the $120-grocery-purchase-plus-$500-card-payment double count).

## Considered Options

- **In-app AI calls during sync** — rejected: recurring API token spend for a batch-shaped workload the owner's Max subscription already covers; also couples sync reliability to an external AI call.
- **Pure rules, no AI** — rejected: the merchant long tail (`SQ *COFFEE 4821`) means hand-authoring rules forever.
- **Cash-view spending** — rejected: reports "money went to the credit-card company," which cannot answer "where is the money going" or power Dial Drift.

## Consequences

- Categorization lag is a designed-in property: new merchants stay visibly UNCATEGORIZED until the next batch run. Per the Honesty Rule, UIs must show the uncategorized count rather than silently under-report.
- The batch job requires the owner's Claude Code environment (or a scheduled routine) to run at intervals; the app degrades gracefully — deterministic layers keep working — if it never runs.
- Reflective spending views run on calendar months; Pay Periods are reserved for the live heartbeat (Safe-to-Spend, Earmarks).
