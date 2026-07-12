# Design: Account Aggregation Foundation

## Context

ADR-0001 (read-only aggregation, no credential custody) and ADR-0002 (managed stack + hardening bundle) fix the security shape. This document covers the technical decisions inside that shape. The repo runs a post-training-data Next.js (16.x) — consult `node_modules/next/dist/docs/` for route handlers, middleware, and caching semantics before writing each piece.

## Provider interface

One deep module, small surface:

```ts
interface AggregatorProvider {
  /** Exchange a user-supplied setup token for a long-lived access secret. */
  claim(setupToken: string): Promise<{ accessSecret: string }>;
  /** Fetch all accounts + transactions since `since` using the access secret. */
  fetchAccounts(accessSecret: string, since?: Date): Promise<FeedSnapshot>;
}
```

`FeedSnapshot` is provider-neutral: accounts (external id, name, institution, type, masked number, balance, balance-as-of, currency) and transactions (external id, account external id, posted date, amount, description, pending). Everything downstream depends only on `FeedSnapshot`; SimpleFIN specifics (base64 claim URLs, Basic-auth access URLs, `/accounts` endpoint) stay inside `SimpleFinProvider`. Swapping in Teller/Plaid later means one new class and zero schema changes.

## Secret handling

- The SimpleFIN access URL embeds credentials — it IS the secret. Stored as `AggregatorConnection.encryptedAccessSecret`: AES-256-GCM, random 12-byte IV per encryption, key from `AGGREGATOR_TOKEN_KEY` (base64, 32 bytes) via `node:crypto`. Ciphertext format: `iv.authTag.ciphertext` base64-joined.
- The key never enters the database or client bundle; encrypt/decrypt happens only in server actions / route handlers ("use server" boundaries).
- Setup tokens are single-use and never persisted — claimed immediately, discarded.

## Data model

```prisma
model AggregatorConnection {
  id                    String   @id @default(uuid())
  userId                String            // household
  provider              String            // "SIMPLEFIN"
  encryptedAccessSecret String
  status                ConnectionStatus  // ACTIVE | ERROR | REVOKED
  lastSyncAt            DateTime?
  lastSyncError         String?
  linkedAccounts        LinkedAccount[]
}

model LinkedAccount {
  id            String   @id @default(uuid())
  connectionId  String
  externalId    String            // provider's account id
  name          String
  institution   String
  accountType   LinkedAccountType // CHECKING | SAVINGS | CREDIT_CARD | LOAN | INVESTMENT | OTHER
  maskedNumber  String?
  currentBalance Decimal @db.Decimal(12, 2)
  balanceAsOf   DateTime
  currency      String   @default("USD")
  profileId     String?           // owner profile; null = household/shared
  mappedDebtId  String?  @unique  // Mapping: feed owns this Debt's balance
  transactions  FeedTransaction[]
  @@unique([connectionId, externalId])
}

model FeedTransaction {
  id              String   @id @default(uuid())
  linkedAccountId String
  externalId      String
  postedAt        DateTime
  amount          Decimal  @db.Decimal(12, 2) // signed; negative = money out
  description     String
  pending         Boolean  @default(false)
  @@unique([linkedAccountId, externalId])
  @@index([linkedAccountId, postedAt])
}
```

Phase-3 categorization fields (bucket, dial, rule provenance) are deliberately absent — added when that change lands.

## Mapping semantics

- Mapping is 1:1 (`mappedDebtId @unique`). Creating a mapping immediately overwrites the Debt's `balance` with `abs(currentBalance)` and on every subsequent sync. The Debt balance input becomes read-only in the UI with a "synced from <institution> · as of <date>" caption and an unmap affordance.
- Unmapping stops syncing and re-enables manual editing; the last synced balance remains.
- `CREDIT_CARD`/`LOAN` accounts offer "map to existing Debt" (type-compatible candidates listed) or "create Debt from this account" (balance from feed; APR/minimum prompted, manual). Depository accounts are not mappable to Debts.

## Sync

- One sync = `fetchAccounts` per active connection → upsert accounts by `(connectionId, externalId)` → upsert transactions by `(linkedAccountId, externalId)` → push balances into mapped Debts → stamp `lastSyncAt`. Idempotent by construction; re-running a sync is always safe.
- Daily Vercel cron (`vercel.json`) → `GET /api/sync` route handler guarded by `Authorization: Bearer ${CRON_SECRET}`. Manual "Refresh now" calls the same core function via server action, rate-limited to once per 10 minutes.
- Failures set `status: ERROR` + `lastSyncError` on the connection and surface a plain-language banner ("Chase hasn't reported since Tuesday — Refresh or re-link"); they never block the rest of the app. Per the Honesty Rule, stale data is labeled, not hidden: every balance renders with its `balanceAsOf`.

## Auth hardening

- Supabase TOTP MFA (`mfa.enroll` / `challenge` / `verify`). A household is "hardened" when at least one TOTP factor is verified; the connections surface is gated on `aal2` session assurance (checked in middleware via `getAuthenticatorAssuranceLevel`).
- Enrollment is prompted at first visit to `/settings/connections` — not forced at signup, so the existing anonymous/manual flow is untouched.
- Password minimum raised to 12 chars in signup validation (existing accounts unaffected until password change).
- Bank data never enters the Zustand persisted store: linked-account/transaction state lives in server components + non-persisted client state only. `dual-path-persistence` explicitly does not apply.

## Trade-offs accepted

- **Setup-token paste over embedded OAuth-style linking**: SimpleFIN's model requires the user to fetch a setup token from the SimpleFIN Bridge site. Slightly clunky once per institution-set; keeps the app out of the credential path entirely (the whole point).
- **Daily freshness**: SimpleFIN refreshes roughly daily. The product treats "as of yesterday" as a feature (calm, not twitchy), with the caption making it honest.
- **Balance overwrite (no reconciliation ledger)**: mapped Debt balances are overwritten, not journaled. Historical balance trend can be derived later from sync snapshots if needed; Phase 1 doesn't store them beyond the current value — the transaction history carries the story.
