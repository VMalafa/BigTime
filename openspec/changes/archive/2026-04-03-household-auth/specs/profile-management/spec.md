## ADDED Requirements

### Requirement: Auto-create default profile on signup
The system SHALL automatically create one Profile when a new User is created. The profile name SHALL be set from the signup form's name field. The profile SHALL be marked as `isDefault: true`.

#### Scenario: Solo user signs up
- **WHEN** a user completes signup with name "Marcus"
- **THEN** a Profile named "Marcus" is created with `isDefault: true`, and the user enters the app without seeing a profile switcher

### Requirement: Add partner profile
The system SHALL allow an authenticated user to add a second profile to their account. The maximum number of profiles per account SHALL be 2.

#### Scenario: User adds a partner profile
- **WHEN** an authenticated user with 1 profile chooses to add a partner and provides the name "Tanya"
- **THEN** a second Profile named "Tanya" is created on the account, and the profile switcher becomes visible

#### Scenario: User attempts to add a third profile
- **WHEN** an authenticated user with 2 profiles attempts to add another profile
- **THEN** the system prevents the action and indicates the maximum has been reached

### Requirement: Profile switcher
The system SHALL display a profile switcher when the account has 2 or more profiles. The switcher SHALL show the name of each profile with a visual indicator for the active profile. Selecting a profile SHALL switch the active profile context.

#### Scenario: Account with one profile
- **WHEN** an authenticated user has exactly 1 profile
- **THEN** the profile switcher is not displayed, and the single profile is automatically active

#### Scenario: Account with two profiles
- **WHEN** an authenticated user has 2 profiles
- **THEN** the profile switcher is displayed showing both profile names

#### Scenario: Switching active profile
- **WHEN** a user clicks on the inactive profile in the switcher
- **THEN** the active profile changes, the flow store loads that profile's data, and the UI reflects the switched profile's state

### Requirement: Active profile persistence
The system SHALL persist the active profile selection in a cookie so that it survives page refreshes and is available to server components and middleware.

#### Scenario: Page refresh after profile switch
- **WHEN** a user switches to Profile B and refreshes the page
- **THEN** Profile B remains the active profile

### Requirement: Add partner prompt
The system SHALL prompt solo users to add a partner profile at natural completion points (flow summary page and/or dashboard).

#### Scenario: Solo user reaches flow summary
- **WHEN** a solo authenticated user completes the flow and reaches the summary page
- **THEN** a prompt is displayed offering to add a partner profile ("Want your partner to go through this too?")
