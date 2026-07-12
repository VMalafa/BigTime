## ADDED Requirements

### Requirement: TOTP MFA enrollment
The system SHALL support enrolling a TOTP authenticator factor on the household account via Supabase MFA. Enrollment SHALL be prompted (and required) before the household's first aggregator connection is created; it SHALL NOT be required for signup or for the manual/anonymous guided flow.

#### Scenario: First visit to connections without a factor
- **WHEN** an authenticated household with no verified TOTP factor visits the connections page
- **THEN** they are guided through TOTP enrollment (QR code + verification) before any linking UI is available

#### Scenario: Manual-only households are unaffected
- **WHEN** a household never links a bank account
- **THEN** they are never forced to enroll MFA and the existing experience is unchanged

### Requirement: MFA challenge on bank-data access
Routes and server actions that read or mutate aggregator connections, linked accounts, or feed transactions SHALL require an MFA-verified session (AAL2). A session authenticated by password alone SHALL be challenged for a TOTP code before proceeding.

#### Scenario: Password-only session opens bank data
- **WHEN** a household member logs in with email+password only and navigates to a bank-data surface
- **THEN** they are prompted for their TOTP code, and the data loads only after successful verification

#### Scenario: API access without AAL2
- **WHEN** a request for bank-data resources arrives from a session below AAL2
- **THEN** the request is rejected server-side (middleware/action guard), regardless of client behavior

### Requirement: Passphrase-strength password
The signup form SHALL require passwords of at least 12 characters (raised from 8), with guidance encouraging a passphrase.

#### Scenario: Short password rejected
- **WHEN** a user submits signup with an 8-character password
- **THEN** a validation error explains the 12-character minimum and suggests a passphrase
