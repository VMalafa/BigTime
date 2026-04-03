## ADDED Requirements

### Requirement: Email and password signup
The system SHALL allow users to create a household account with an email address, name, and password via the existing signup page. On successful signup, the system SHALL create a Prisma `User` record and a default `Profile` using the provided name, in a single transaction. The Supabase `auth.uid()` SHALL be used as the Prisma User `id`.

#### Scenario: Successful signup with email and password
- **WHEN** a user submits the signup form with a valid name, email, and password (8+ characters)
- **THEN** a Supabase auth account is created, a Prisma User and default Profile are created, and the user is redirected to `/flow`

#### Scenario: Signup with duplicate email
- **WHEN** a user submits the signup form with an email that already exists
- **THEN** the system displays an error message and does not create a new account

#### Scenario: Signup with invalid password
- **WHEN** a user submits the signup form with a password shorter than 8 characters
- **THEN** the system displays a validation error and does not submit

### Requirement: Email and password login
The system SHALL allow users to log into an existing household account with their email and password via the existing login page.

#### Scenario: Successful login
- **WHEN** a user submits the login form with valid credentials
- **THEN** a Supabase session is established and the user is redirected to `/dashboard`

#### Scenario: Login with incorrect credentials
- **WHEN** a user submits the login form with an invalid email or password
- **THEN** the system displays a generic error message ("Invalid email or password")

### Requirement: Google OAuth signup and login
The system SHALL allow users to sign up or log in with Google OAuth. On first Google sign-in, the system SHALL create a User and default Profile using the Google account name.

#### Scenario: First-time Google sign-in
- **WHEN** a user clicks "Sign up with Google" and completes the OAuth flow
- **THEN** a Supabase auth account is created via OAuth, a Prisma User and default Profile are created, and the user is redirected to `/flow`

#### Scenario: Returning Google sign-in
- **WHEN** a user clicks "Sign in with Google" and has an existing account
- **THEN** the existing Supabase session is restored and the user is redirected to `/dashboard`

### Requirement: OAuth callback handling
The system SHALL handle the Supabase OAuth redirect at `/auth/callback` by exchanging the authorization code for a session.

#### Scenario: Valid OAuth callback
- **WHEN** Supabase redirects to `/auth/callback` with a valid authorization code
- **THEN** the system exchanges the code for a session and redirects to the appropriate page

### Requirement: Session-based route protection
The system SHALL protect `/dashboard` and `/partner` routes by redirecting unauthenticated users to `/auth/login`. The `/flow` route SHALL remain accessible to unauthenticated users.

#### Scenario: Unauthenticated user visits protected route
- **WHEN** an unauthenticated user navigates to `/dashboard`
- **THEN** they are redirected to `/auth/login`

#### Scenario: Unauthenticated user visits flow
- **WHEN** an unauthenticated user navigates to `/flow`
- **THEN** they are allowed to proceed (no redirect)

### Requirement: Logout
The system SHALL provide a way for authenticated users to log out, clearing their Supabase session.

#### Scenario: User logs out
- **WHEN** an authenticated user triggers logout
- **THEN** the Supabase session is destroyed and the user is redirected to the landing page
