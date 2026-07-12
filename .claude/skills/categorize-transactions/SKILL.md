---
name: categorize-transactions
description: Interval batch categorization of UNCATEGORIZED feed transactions (ADR-0003). Reads the queue, categorizes merchants into the app's exact taxonomy, writes back labels + generalized CategoryRules (source batch) so the deterministic share grows each run. Runs on the owner's Max subscription — never the app's ANTHROPIC_API_KEY.
---

# /categorize-transactions — interval batch

The AI layer of the categorization pipeline deliberately does **not** run in
the app (ADR-0003). This skill is that layer: it runs here, in the owner's
Claude Code environment, at whatever interval the owner chooses.

## Taxonomy — the app's language, nothing else

Two levels, exactly as in CONTEXT.md:

1. **CSP bucket**: `FIXED_COSTS`, `SAVINGS`, `INVESTMENTS`, `GUILT_FREE`
2. Within `GUILT_FREE`, one **Money Dial**: `TRAVEL`, `FOOD_DINING`,
   `HEALTH_FITNESS`, `CONVENIENCE`, `TECHNOLOGY`, `FASHION`, `EXPERIENCES`,
   `EDUCATION`, `GIVING`.
   Within `FIXED_COSTS`, one **fixed-cost category**: `HOUSING`, `INSURANCE`,
   `UTILITIES`, `TRANSPORTATION`, `SUBSCRIPTIONS`, `DEBT_MINIMUMS`, `OTHER`.

Never invent a third taxonomy. When genuinely unsure of a merchant, leave it
out of the mapping — it stays visibly UNCATEGORIZED (Honesty Rule) and a
future run or human Correction picks it up.

## Steps

1. **Read the queue** (read-only; uses DATABASE_URL from `.env`):

   ```
   node --env-file=.env scripts/categorize-queue.ts status
   ```

   Output: one line per normalized merchant pattern with count, dollar
   total, and sample descriptions. If the queue is empty, stop — re-running
   on an empty queue is a no-op by design.

2. **Categorize each merchant** you are confident about. Write a mapping
   file (e.g. `categorize-mapping.json`, gitignored by name below) shaped:

   ```json
   {
     "entries": [
       { "merchantPattern": "SQ COFFEE", "cspBucket": "GUILT_FREE", "moneyDial": "FOOD_DINING" },
       { "merchantPattern": "GEICO", "cspBucket": "FIXED_COSTS", "fixedCostCategory": "INSURANCE" }
     ]
   }
   ```

   Use the *normalized* patterns exactly as `status` printed them (or a
   shorter substring that still uniquely identifies the merchant —
   generalize where safe, e.g. `NETFLIX` rather than `NETFLIX COM`).

3. **Apply** (atomic — labels + rules in one database transaction):

   ```
   node --env-file=.env scripts/categorize-queue.ts apply categorize-mapping.json
   ```

   The script validates the mapping against the taxonomy (bad entries reject
   the whole run), writes `CategoryRule` rows with `source: BATCH`, labels
   the matching queue transactions with `categorizationSource: BATCH`, and
   prints queue-before → queue-after plus rules created.

4. **Report**: queue count before/after, rules created, merchants left
   uncategorized and why (e.g. ambiguous). Delete the mapping file.

## Guarantees (enforced by the script — do not work around them)

- **Correction-sourced rules are never overwritten**; their patterns are
  skipped and reported. Human decisions are terminal.
- Only `UNCATEGORIZED`, non-Transfer, money-out transactions are labeled;
  a transaction a human corrected is never relabeled.
- Rules are per-household and only written for merchants present in that
  household's queue.
- Re-running with an empty queue (or an empty mapping) is a no-op.

## Hard boundaries

- This skill runs on the owner's Max subscription. Never call the Anthropic
  API, never use the app's `ANTHROPIC_API_KEY`.
- Never print `.env` contents or transaction data beyond merchant
  descriptions and amounts.
