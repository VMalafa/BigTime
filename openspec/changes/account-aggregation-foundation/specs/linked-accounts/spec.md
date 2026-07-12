## ADDED Requirements

### Requirement: Linked account inventory
The system SHALL present all accounts discovered through active connections with name, institution, account type, masked number (never a full account number), current balance, and balance freshness ("as of <date>"). Each linked account MAY be assigned to a Profile (owner) or left as household-shared.

#### Scenario: Accounts appear after linking
- **WHEN** a connection's initial sync completes
- **THEN** each discovered account appears in the inventory with its balance and an "as of" timestamp from the feed

#### Scenario: No full account numbers anywhere
- **WHEN** any linked-account data is stored or rendered
- **THEN** only the provider's masked identifier is used; full account numbers and SSNs are never stored

### Requirement: Mapping a linked account to a Debt
The system SHALL allow a credit-card or loan linked account to be mapped 1:1 to an existing type-compatible Debt, or to create a new Debt from the account. Once mapped, the feed owns the Debt's balance: each sync overwrites it, and the balance becomes read-only in the UI with a synced-from caption. APR, minimum payment, and credit limit SHALL remain manually editable. Depository accounts SHALL NOT be mappable to Debts.

#### Scenario: Mapping to an existing Debt
- **WHEN** a household maps the "Chase Sapphire" linked account to the manual Debt "Chase Sapphire — $4,200"
- **THEN** the Debt's balance immediately updates to the feed's absolute balance, its balance field becomes read-only with "synced from Chase · as of <date>", and its APR/minimum stay as entered

#### Scenario: Creating a Debt from a linked account
- **WHEN** a household chooses "create Debt" on an unmapped credit-card account
- **THEN** a Debt is created with the feed balance and account name, the household is prompted for APR and minimum payment, and the mapping is established

#### Scenario: One mapping per Debt
- **WHEN** a household attempts to map a linked account to a Debt that is already mapped
- **THEN** the system prevents it and identifies the existing mapping

#### Scenario: Unmapping restores manual control
- **WHEN** a household unmaps a linked account from its Debt
- **THEN** the Debt keeps its last synced balance, the balance field becomes editable again, and future syncs no longer touch it

### Requirement: Manual records remain first-class
The system SHALL continue to fully support Debts with no mapped linked account (created, edited, and included in all views and calculations exactly as before).

#### Scenario: Unlinkable debt coexists
- **WHEN** a household tracks a family loan as a manual Debt alongside mapped accounts
- **THEN** the manual Debt participates in payoff strategies, totals, and the dashboard identically to mapped Debts, with its balance manually maintained
