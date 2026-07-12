# Tasks: Account Aggregation Foundation

> Before each implementation area, read the relevant guide in `node_modules/next/dist/docs/` (route handlers, middleware, server actions, caching) — this Next.js version differs from training data.

## 1. Data model

- [x] 1.1 Add `ConnectionStatus` and `LinkedAccountType` enums, and `AggregatorConnection`, `LinkedAccount`, `FeedTransaction` models to `prisma/schema.prisma` per design.md (unique on `(connectionId, externalId)` and `(linkedAccountId, externalId)`; `mappedDebtId @unique`)
- [x] 1.2 Add the `linkedAccount` back-relation to `Debt`; validate with `npx prisma validate` and apply schema out-of-band (no Prisma Migrate in this repo — see itemize-fixed-costs 1.4) — **reference DDL committed at `docs/sql/account-aggregation-foundation.sql`; run it against Supabase (incl. its enable-RLS block) before deploying**

## 2. Crypto & environment

- [x] 2.1 Implement `src/lib/aggregator/secret-box.ts`: AES-256-GCM encrypt/decrypt (`iv.authTag.ciphertext`, base64) keyed from `AGGREGATOR_TOKEN_KEY`; unit-test roundtrip and tamper rejection
- [x] 2.2 Add `AGGREGATOR_TOKEN_KEY` and `CRON_SECRET` to `.env.example` with generation instructions (`openssl rand -base64 32`)

## 3. Provider layer

- [x] 3.1 Define `AggregatorProvider` + `FeedSnapshot` types in `src/lib/aggregator/provider.ts`
- [x] 3.2 Implement `SimpleFinProvider` (`claim` decodes/POSTs the setup token's claim URL; `fetchAccounts` GETs `/accounts` with Basic auth from the access URL, maps to `FeedSnapshot`)
- [x] 3.3 Map SimpleFIN account types/balances to `LinkedAccountType` and signed transaction amounts; handle pending transactions

## 4. Sync engine

- [x] 4.1 Implement `syncConnection(connectionId)`: fetch snapshot → upsert accounts → upsert transactions → overwrite mapped Debt balances → stamp `lastSyncAt`; per-connection error isolation setting `status`/`lastSyncError`
- [x] 4.2 Route handler `src/app/api/sync/route.ts` guarded by `CRON_SECRET` bearer token; syncs all active connections
- [x] 4.3 Add `vercel.json` cron entry (daily) targeting the sync route
- [x] 4.4 Server action `refreshNow()` with a 10-minute per-household rate limit

## 5. Auth hardening

- [x] 5.1 TOTP enrollment component (Supabase `mfa.enroll`/`verify`, QR + code entry) and challenge component (`mfa.challenge`/`verify`)
- [x] 5.2 AAL2 guard: middleware (or shared action guard) rejecting bank-data routes/actions below `aal2`; gate `/settings/connections` behind it
- [x] 5.3 Raise signup password validation to 12 chars with passphrase guidance
- [x] 5.4 Verify no linked-bank data flows through the Zustand persisted store or any localStorage path

## 6. Connections & mapping UI

- [x] 6.1 `/settings/connections` page: setup-token entry with SimpleFIN Bridge instructions, claim flow, error states
- [x] 6.2 Linked-account inventory: institution, name, type, masked number, balance + "as of" caption, owner Profile selector, connection health banner with Refresh/Re-link/Delete
- [x] 6.3 Mapping flow for credit/loan accounts: map to type-compatible existing Debt, or create Debt (prompt APR/minimum); unmap affordance
- [x] 6.4 Debt forms/dashboard: read-only balance with synced-from caption when mapped; unchanged behavior when not

## 7. Verification

- [ ] 7.1 End-to-end against a real SimpleFIN Bridge token (or their demo token): claim → initial sync → accounts visible → map a card → balance overwrites Debt → re-sync idempotent — **deferred: needs live Supabase + a SimpleFIN setup token (supplied out-of-band)**
- [ ] 7.2 Confirm AAL2 gating: password-only session is challenged; anonymous flow untouched — **deferred: needs a live Supabase project with TOTP MFA enabled**
- [x] 7.3 Confirm DB-only exposure yields no usable secret (ciphertext without env key) — covered by `secret-box.test.ts` (wrong-key, tampered-tag, and tampered-ciphertext all reject)
- [x] 7.4 `npm run build` and lint pass
