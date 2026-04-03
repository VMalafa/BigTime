## ADDED Requirements

### Requirement: Merged financial data
The system SHALL compute a combined household financial picture by aggregating data across all profiles in the account. This includes total debts, total income, and merged spending categories.

#### Scenario: Two profiles with separate debts
- **WHEN** Profile A has $5,000 in student loans and Profile B has $3,000 in credit card debt
- **THEN** the combined view shows $8,000 total household debt with both debts listed

#### Scenario: Solo account financials
- **WHEN** an account has only 1 profile
- **THEN** the combined view shows that profile's data (no aggregation needed, same result)

### Requirement: Combined AI advisor context
The system SHALL provide the AI advisor with both profiles' money types, money scripts, and money dials as context. AI advice SHALL be empathetic, non-judgmental, and address the household collectively rather than singling out individuals.

#### Scenario: AI advice for couple with different money types
- **WHEN** Profile A is an Optimizer and Profile B is a Worrier, and they ask about vacation budgeting
- **THEN** the AI provides advice that acknowledges both perspectives empathetically and suggests a path that honors both the desire to optimize and the need for financial security

#### Scenario: AI advice for solo user
- **WHEN** an account has 1 profile typed as a Dreamer
- **THEN** the AI provides advice tailored to that single persona without referencing a partner

### Requirement: Dashboard shows household-level data
The dashboard SHALL display merged financials by default. Individual profile data SHALL be accessible but the primary view is the household.

#### Scenario: Couple views dashboard
- **WHEN** either partner logs in and views the dashboard
- **THEN** they see combined household income, total debts, and merged spending plan

## REMOVED Requirements

### Requirement: Partnership model
**Reason**: Replaced by the household account + Profile model. Couples are now profiles within one account rather than two linked accounts.
**Migration**: All partnership-related data (RichLifeVision, MoneyRule, JointSpendingPlan) will be reconsidered in future changes under the new household model.

### Requirement: Partner invite flow
**Reason**: No longer needed. Adding a partner is done by creating a second profile on the same account, not by sending email invites between separate accounts.
**Migration**: Remove PartnerInvite model and related UI.

### Requirement: Privacy settings
**Reason**: All data is shared within a household account. There is no concept of hiding data from a partner since both share the same login.
**Migration**: Remove PrivacySettings model and related UI.
