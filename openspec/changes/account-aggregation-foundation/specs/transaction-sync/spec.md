## ADDED Requirements

### Requirement: Idempotent transaction ingestion
The system SHALL ingest feed transactions by upserting on the provider's transaction identity per account, so that re-running any sync never duplicates or drops data. Each transaction stores posted date, signed amount, description, and pending status.

#### Scenario: Same sync runs twice
- **WHEN** a sync runs twice over the same feed window
- **THEN** the transaction set in the database is identical to running it once

#### Scenario: Pending transaction settles
- **WHEN** a transaction previously ingested as pending later posts with the same external identity
- **THEN** the existing record is updated in place (pending → posted, final amount), not duplicated

### Requirement: Scheduled daily sync
The system SHALL sync all active connections on a daily schedule via a route handler that requires the configured cron secret. A failure for one connection SHALL NOT prevent syncing the others.

#### Scenario: Cron fires
- **WHEN** the scheduled job calls the sync endpoint with the valid secret
- **THEN** every active connection syncs, mapped Debt balances update, and each connection's last-sync timestamp advances

#### Scenario: Unauthorized sync attempt
- **WHEN** the sync endpoint is called without the valid cron secret
- **THEN** the request is rejected and no sync occurs

### Requirement: Manual refresh
The system SHALL provide a "Refresh now" action on the connections surface that runs the same sync, rate-limited to once per 10 minutes per household.

#### Scenario: Manual refresh inside the rate limit
- **WHEN** a household taps "Refresh now" twice within 10 minutes
- **THEN** the second attempt is declined with the time remaining, and no sync runs

### Requirement: Freshness is always visible
Every balance or number derived from feed data SHALL display when it was last synced. Stale data SHALL be labeled, never hidden or silently substituted (Honesty Rule).

#### Scenario: Feed is a day behind
- **WHEN** a linked account's last successful sync was 26 hours ago
- **THEN** its balance renders with "as of yesterday" and the dashboard remains fully functional

### Requirement: Bank data never leaves the authenticated boundary
Linked accounts, balances, and transactions SHALL be served only to MFA-verified authenticated sessions and SHALL never be written to localStorage or any client-side persistent store.

#### Scenario: Anonymous session
- **WHEN** an anonymous (localStorage-mode) visitor uses the guided flow
- **THEN** no bank-linked data is fetched, rendered, or persisted client-side; the manual flow behaves exactly as it does today
