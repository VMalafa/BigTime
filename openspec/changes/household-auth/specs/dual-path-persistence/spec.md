## ADDED Requirements

### Requirement: Pre-flow signup option
The system SHALL offer a signup option on or before the flow entry page, so users can create an account before entering any financial data.

#### Scenario: User signs up before starting flow
- **WHEN** a user on the landing or flow entry page chooses to sign up first
- **THEN** they complete signup and are redirected to `/flow` with DB-backed persistence active

### Requirement: Authenticated real-time persistence
The system SHALL save flow data to the database in real-time as authenticated users progress through the flow. Writes SHALL be debounced (500ms) to avoid excessive DB calls.

#### Scenario: Authenticated user enters debt information
- **WHEN** an authenticated user adds a debt entry on the debts page
- **THEN** the debt is saved to the active Profile in the database within 500ms

#### Scenario: Authenticated user leaves mid-flow and returns
- **WHEN** an authenticated user completes 3 of 6 flow steps, closes the browser, and returns later
- **THEN** their previously entered data is loaded from the database and they can continue from where they left off

### Requirement: Anonymous localStorage persistence
The system SHALL continue to use localStorage for anonymous (unauthenticated) users, maintaining the existing Zustand persist behavior.

#### Scenario: Anonymous user enters data
- **WHEN** an unauthenticated user enters flow data
- **THEN** the data is saved to localStorage under the `rich-life-flow` key

### Requirement: localStorage-to-DB migration on signup
The system SHALL migrate existing localStorage flow data to the user's new Profile when they sign up. After successful migration, the localStorage `rich-life-flow` key SHALL be cleared.

#### Scenario: Anonymous user with flow data signs up
- **WHEN** a user who has completed 4 flow steps in localStorage signs up
- **THEN** all their flow data (scripts, money type, debts, income, spending plan, dials) is migrated to their new Profile in the database, and localStorage is cleared

#### Scenario: Anonymous user with no flow data signs up
- **WHEN** a user with no localStorage flow data signs up
- **THEN** a Profile is created with no flow data, and the user starts the flow fresh

### Requirement: Transparent persistence layer
The flow store SHALL abstract the persistence mechanism so that flow page components do not need to know whether data is being saved to localStorage or the database. The same `useFlowStore` API SHALL work in both modes.

#### Scenario: Flow page component writes data
- **WHEN** any flow page calls `useFlowStore.setState()` with updated data
- **THEN** the data is persisted to the correct backend (DB or localStorage) without the component specifying which
