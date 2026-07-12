## ADDED Requirements

### Requirement: Provider-agnostic aggregator interface
The system SHALL access bank data exclusively through an `AggregatorProvider` interface (claim a setup token; fetch a provider-neutral snapshot of accounts and transactions). No code outside the provider implementation SHALL depend on SimpleFIN-specific formats.

#### Scenario: Downstream code consumes only the neutral snapshot
- **WHEN** sync, mapping, or UI code reads feed data
- **THEN** it consumes the provider-neutral `FeedSnapshot`/database shapes, and swapping the provider implementation requires no changes to those consumers

### Requirement: Claiming a SimpleFIN setup token
The system SHALL let an authenticated, MFA-verified household submit a SimpleFIN setup token. The system SHALL claim it immediately, store only the resulting access secret encrypted with AES-256-GCM under a key held in an environment variable, and SHALL never persist the setup token or any bank credential.

#### Scenario: Successful claim
- **WHEN** a household pastes a valid SimpleFIN setup token on the connections page
- **THEN** the token is claimed, an `AggregatorConnection` with an encrypted access secret is created, an initial sync runs, and the discovered accounts are listed

#### Scenario: Invalid or already-claimed token
- **WHEN** a household submits an expired, malformed, or already-claimed setup token
- **THEN** the system shows a plain-language error with a link to SimpleFIN Bridge instructions, and nothing is persisted

#### Scenario: Database contents alone cannot reach the bank feed
- **WHEN** the database contents are exposed without the runtime environment
- **THEN** the stored connection secret is AES-256-GCM ciphertext that cannot be used to fetch bank data

### Requirement: Connection health visibility
The system SHALL track each connection's status (`ACTIVE`, `ERROR`, `REVOKED`) and last successful sync time, and SHALL surface failures in plain language without blocking the rest of the app.

#### Scenario: Feed stops responding
- **WHEN** a sync fails for a connection
- **THEN** the connection shows an error state naming the institution and the last good sync date, with "Refresh" and "Re-link" actions, while all previously synced data remains visible with its freshness labels

#### Scenario: Household revokes a connection
- **WHEN** a household deletes a connection
- **THEN** the encrypted secret and the connection record are deleted, its linked accounts stop syncing, and any mapped Debts revert to manual balance editing (retaining their last synced value)
