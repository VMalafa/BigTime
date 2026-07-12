# Proposal: Account Aggregation Foundation (Phase 1)

## Why

Every number in Rich Life today is hand-typed and goes stale the moment it's entered. The household wants one trustworthy place to see their real financial picture — but manual balances can't power "are we okay until Friday?" (Phase 2), spending-pattern insights (Phase 3), or bonus detection (Phase 4). This change lays the foundation: read-only bank data flowing into the app daily, mapped onto the existing manual model, behind a hardened login.

Per ADR-0001, the app never stores bank credentials — linking happens through SimpleFIN Bridge (read-only by design, ~$15/yr), wrapped in a provider interface so the aggregator can be swapped. Per ADR-0002, bank data only enters a hardened, authenticated household: required TOTP MFA, passphrase-strength password, and app-layer encryption of the aggregator token.

## What Changes

- **Aggregator provider interface + SimpleFIN implementation** — a thin `AggregatorProvider` abstraction (claim setup token → access URL; fetch accounts + transactions) with SimpleFIN as the first provider. The SimpleFIN access URL (the secret) is encrypted with AES-256-GCM using a key held only in an environment variable, never in the database.
- **Account linking flow** — a settings surface where the household pastes a SimpleFIN setup token; the app claims it, stores the encrypted access URL, and lists the discovered accounts (name, institution, type, masked number, balance).
- **Linked Account → Debt mapping** — each discovered credit-card/loan account can be mapped to an existing `Debt` (or spawn a new one). Once mapped, the feed owns the Debt's balance (read-only in the UI, updated each sync); APR, minimum payment, and credit limit stay manual. Unmapped manual Debts continue to work unchanged.
- **Transaction ingestion + daily sync** — idempotent upsert of feed transactions per account; a daily scheduled sync (Vercel cron hitting a secret-protected route handler) plus a manual "Refresh now" button. Every derived number displays its "as of" freshness.
- **Auth hardening (modifies `household-auth`)** — TOTP MFA enrollment required before any bank-data feature unlocks; MFA challenge enforced (AAL2) on all bank-data routes; password minimum raised to a 12+ character passphrase; linked-bank data is never written to localStorage or served to anonymous sessions (constrains `dual-path-persistence` scope, whose spec covers only guided-flow data and needs no delta).

Explicitly **not** in this change (later phases): paycheck detection and Pay Periods (Phase 2), transaction categorization (Phase 3), bonus detection and utilization engine (Phase 4), goals (Phases 2–5).

## Capabilities

### New Capabilities

- `aggregator-connection`: claim, encrypt, store, and health-check a read-only aggregator connection behind a provider interface (SimpleFIN first).
- `linked-accounts`: discover accounts from the feed, present them with balances and freshness, and map them onto manual Debts with feed-owned balances.
- `transaction-sync`: scheduled and manual idempotent ingestion of balances and transactions, with freshness surfaced everywhere derived numbers appear.

### Modified Capabilities

- `household-auth`: adds TOTP MFA enrollment/challenge requirements and the passphrase rule; bank-data routes require AAL2.

## Impact

- **Database**: new `AggregatorConnection`, `LinkedAccount`, `FeedTransaction` models; `Debt` gains an optional back-relation to its mapped `LinkedAccount`. Schema applied out-of-band (no Prisma Migrate in this repo — see itemize-fixed-costs 1.4).
- **New surfaces**: `/settings/connections` (link, account list, mapping, refresh), sync route handler for cron.
- **Auth**: middleware gains AAL2 enforcement for bank-data routes; login/signup pages gain MFA enrollment + challenge steps.
- **Env**: `AGGREGATOR_TOKEN_KEY` (32-byte key for AES-256-GCM), `CRON_SECRET`.
- **Dependencies**: none new required (SimpleFIN is plain HTTPS + Basic auth; Web Crypto/node:crypto suffices). Vercel cron configured via `vercel.json`.
- **Existing specs**: `combined-household-view` naturally reflects feed-updated Debt balances without requirement changes; `dual-path-persistence` untouched (bank data is explicitly outside its scope).
