# One source of truth: the flow-store/database duality

Research asset for [wayfinder ticket #28](https://github.com/VMalafa/BigTime/issues/28),
part of the [Back to the essence map (#24)](https://github.com/VMalafa/BigTime/issues/24).
Catalogs where every domain entity lives today, how the copies talk to each
other, where they diverge, and proposes the target architecture for a
feed-first app. Facts verified against the code on 2026-07-13.

## Where each entity lives

| Entity | Client (zustand `rich-life-flow` in localStorage) | Server (Prisma) | Sync mechanism |
| --- | --- | --- | --- |
| Money Scripts | `scripts` | `MoneyScript` | debounced flush → per-row upsert |
| Money Type | `moneyType` | `Profile.moneyType` | debounced flush → update |
| Debts | `debts` | `Debt` | debounced flush → **diff-based** (protects Mappings + feed-owned balances) |
| Income sources | `incomeSources` | `IncomeSource` | debounced flush → **deleteMany + createMany (full replace)** |
| Bonus items | `bonusItems` | `BonusItem` | debounced flush → **full replace** |
| CSP + line items | `spendingPlan` | `SpendingPlan` + `FixedCostLineItem` | debounced flush → upsert plan, **full-replace line items** |
| Money Dials | `moneyDials` | `MoneyDial` | debounced flush → upserts |
| Flow UI state | `currentStep`, `isComplete` | — | client-only (correctly so) |
| Linked Accounts, FeedTransactions, Categorization, CategoryRules, ProposalDecisions | — | server tables | server-only (single home ✓) |
| Partner store | separate zustand store | partner tables | out of this catalog; same disease, lower stakes |

**The feed-side layer (everything built in #10–#22) is already
single-source.** The duality is confined to the original planning entities.

## The sync paths, and where they leak

1. **Hydrate**: on auth, `useFlowPersistence` loads all profile data
   (`loadProfileFlowData`) and overwrites the store. DB wins at mount.
2. **Flush**: every store change schedules a 500 ms-debounced batch of
   `persist*` server actions. Client wins at flush — **whole-array,
   last-writer-wins**.
3. **Migrate**: `useMigrateLocalData` pushes anonymous localStorage data into
   the DB once after signup.
4. **Proposals (mixed writes)**: confirming a Debt Proposal writes the Debt +
   Mapping server-side, then mirrors into the store; confirming income or a
   fixed cost adds to the store only and relies on the debounced flush to
   reach the DB.

### Divergence risks, concrete

- **Lost writes on navigation** (proven during #13's E2E): a full page load
  within ~1 s of a change aborts both the in-flight server action and the
  pending debounced flush. The optimistic UI keeps the data; the DB never
  gets it — silent, permanent divergence until the next flush of that array.
- **Full-replace clobbering**: income sources, bonus items, and line items
  are `deleteMany + createMany` on every flush. A stale tab, second device,
  or laptop that hydrated an hour ago flushes its old array and silently
  reverses newer writes (including server-side Proposal confirmations that
  hadn't reached that client). Row ids churn on every flush, so nothing else
  may ever reference a line item by id.
- **Two readers, two answers**: the dashboard home merges store selectors
  (income, plan, bonuses) with a server action (`getHouseholdFinancials`) in
  one component; the Spending page and heartbeat read Prisma exclusively;
  flow pages read the store exclusively. Numbers on adjacent screens can
  legitimately disagree during any divergence window — the felt
  "disjointedness" has a mechanical cause.
- **localStorage outlives the session**: signout does not clear
  `rich-life-flow`; the next visitor on the machine sees the previous
  household's draft, and a later signin can flush it over their data.
- **Type drift**: DB Decimals ↔ store numbers round-trip through JSON with
  ad-hoc conversions at each boundary.

## Target architecture (recommendation)

**Server-authoritative everywhere; the store retires from domain data.**
The feed-first spine makes this natural — the newest, best-liked surfaces
(Spending, heartbeat) already work this way.

1. **Prisma is the only home** for every domain entity. Reads happen in
   server components (Spending-page pattern) or explicit fetch actions.
2. **Mutations are awaited server actions, one per intent**
   (`addIncomeSource`, `confirmProposal`, `updateLineItem`) — no whole-array
   flushes, no fire-and-forget. Optimistic UI via `useOptimistic`/local
   state with rollback, which the Corrections panel already models
   correctly. This structurally eliminates both the lost-write and
   clobbering classes.
3. **The zustand store shrinks to UI state** (current step, open panels).
   `useFlowPersistence`'s subscribe-and-flush machinery is deleted.
4. **Signup-first, delete the anonymous draft layer** (recommended, needs
   ratification): the spine starts at "link accounts", which requires an
   account anyway, and the audience decision is this-household-first. The
   anonymous localStorage flow, the migration hook, and the dual
   bookkeeping all disappear. *Alternative if anonymous try-before-signup
   must survive*: keep the store as a pre-auth draft only, migrate once at
   signup (existing machinery), and make it read-only after auth.
5. **Migration for existing data**: one-time — hydrate nothing; DB rows as
   they stand today are the truth (they were flushed recently); clear
   `rich-life-flow` from localStorage on next authed visit.

**Cost**: the flow pages (debts, income, fixed costs, spending plan) move
from store reads/writes to server data + awaited actions — roughly one
focused issue per step, mechanical rather than clever. **Payoff**: every
screen answers from the same place, and an entire class of "the app
disagrees with itself" bugs becomes unrepresentable.

## What this unblocks

- A ratification decision (grilling): adopt server-authoritative +
  signup-first, or keep an anonymous draft mode.
- The One Flow ticket (#26): signup timing intersects directly with §4.
- Future spec-cut issues: per-step conversion of flow pages, deletion of
  `useFlowPersistence`/`useMigrateLocalData`, signout cleanup.
