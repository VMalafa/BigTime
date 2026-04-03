## 1. Schema Migration

- [x] 1.1 Add `Profile` model to Prisma schema with fields: id, userId, name, isDefault, moneyType, and relations to MoneyScript, Debt, IncomeSource, SpendingPlan, MoneyDial
- [x] 1.2 Migrate all personal financial data references from `userId` to `profileId` in MoneyScript, Debt, IncomeSource, SpendingPlan, MoneyDial models
- [x] 1.3 Remove `Partnership`, `PartnerInvite`, `RichLifeVision`, `MoneyRule`, `JointSpendingPlan`, and `PrivacySettings` models from schema
- [x] 1.4 Update `User` model: remove direct financial data relations, add `profiles` relation, keep email/name/createdAt/updatedAt
- [x] 1.5 Keep `WholenessScore`, `AutomationItem`, `CheckIn` on `User` (household-level) — verify references are correct after schema changes
- [x] 1.6 Run `npx prisma db push` or create migration to apply schema changes

## 2. Supabase Auth Wiring

- [x] 2.1 Wire signup page `handleSubmit` to call `supabase.auth.signUp()` with email and password
- [x] 2.2 Create server action `createUserAndProfile` that creates Prisma User (using Supabase auth.uid as id) + default Profile in a transaction
- [x] 2.3 Call `createUserAndProfile` after successful Supabase signup, passing the name from the form
- [x] 2.4 Wire login page `handleSubmit` to call `supabase.auth.signInWithPassword()`
- [x] 2.5 Wire Google OAuth: `handleGoogleSignUp` calls `supabase.auth.signInWithOAuth({ provider: 'google' })`
- [x] 2.6 Implement `/auth/callback/route.ts` to exchange OAuth code for session and create User+Profile if first sign-in
- [x] 2.7 Add logout functionality (supabase.auth.signOut) with redirect to landing page
- [x] 2.8 Add error handling and validation feedback on signup/login forms (duplicate email, wrong credentials, short password)

## 3. Pre-Flow Signup Option

- [x] 3.1 Add a "Sign up to save progress" button/link on the flow entry page (`/flow`) alongside the existing start button
- [x] 3.2 Ensure signup redirects back to `/flow` after account creation (not to dashboard)

## 4. Profile Management

- [x] 4.1 Create `<ProfileSwitcher>` client component that displays profile names with active indicator
- [x] 4.2 Implement active profile cookie: set on profile switch, read in server components/middleware
- [x] 4.3 Add ProfileSwitcher to the app shell/layout (only visible when 2+ profiles exist)
- [x] 4.4 Create "Add partner profile" server action that creates a second Profile (enforce max 2)
- [x] 4.5 Build "Add partner" UI — a form that accepts the partner's name, accessible from both the summary page and dashboard
- [x] 4.6 When partner profile is added, show profile switcher and prompt partner to go through the flow

## 5. Dual-Path Persistence

- [x] 5.1 Create a persistence adapter in the flow store that checks auth state (is user logged in?)
- [x] 5.2 For authenticated users: create server actions for each flow step that upsert data to the active Profile (debounced 500ms)
- [x] 5.3 For anonymous users: keep existing localStorage persist middleware (no changes needed)
- [x] 5.4 On flow page load (authenticated): hydrate the Zustand store from the active Profile's DB data instead of localStorage
- [x] 5.5 Ensure `useFlowStore` API remains unchanged — flow page components should not need modifications

## 6. localStorage Migration

- [x] 6.1 Create `migrateFlowData` server action that reads the localStorage shape and writes to the new Profile
- [x] 6.2 On signup: check if localStorage has `rich-life-flow` data, call `migrateFlowData` if so
- [x] 6.3 After successful migration: clear the `rich-life-flow` key from localStorage
- [x] 6.4 Handle edge cases: empty localStorage, partial data, malformed data (log warning, skip gracefully)

## 7. Combined Household View

- [x] 7.1 Create a `getHouseholdFinancials` server action/query that aggregates debts, income, and spending across all profiles for a User
- [x] 7.2 Update dashboard page to use `getHouseholdFinancials` for merged financial display
- [x] 7.3 Create AI context builder function that assembles both profiles' money types, scripts, and dials into a structured prompt context

## 8. Cleanup

- [x] 8.1 Remove all Partnership/PartnerInvite-related UI components and pages that are no longer needed
- [x] 8.2 Remove PrivacySettings UI components
- [x] 8.3 Update the partner onboarding pages to work with the new profile model or remove if superseded
- [x] 8.4 Verify middleware route protection works correctly with new auth flow
- [x] 8.5 Test end-to-end: anonymous flow → signup → data migrated → add partner → profile switch → combined view
