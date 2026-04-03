## Why

Users currently complete the financial wellness flow with data stored only in localStorage, which can be lost if the browser cache is cleared. There is no authentication system wired up, so users cannot persist their work across devices or sessions. Additionally, couples — who are a core audience — have no way to build separate financial personas under a shared household context, which is essential for the AI advisor to provide empathetic, non-judgmental guidance that speaks to both partners.

## What Changes

- **Wire Supabase authentication** — connect the existing stubbed signup/login pages to Supabase Auth (email/password + Google OAuth)
- **Introduce a household account model** — one shared login per household, with a Profile model for each person (Netflix-style profile switcher)
- **Add pre-flow signup option** — users can sign up before entering the flow to save progress in real-time, preventing partial work loss
- **Dual-path persistence** — authenticated users save to DB as they go; anonymous users continue with localStorage and can sign up later
- **localStorage-to-DB sync on signup** — when an anonymous user signs up, their localStorage flow data migrates to a Profile in the database
- **Profile switcher UI** — appears only when 2+ profiles exist on the account; solo users go straight in
- **"Add partner" prompt** — after completing the solo flow, prompt to add a second profile for a partner
- **Combined household view** — merged financials across profiles for the dashboard and AI context
- **BREAKING**: Remove `Partnership`, `PartnerInvite`, and `PrivacySettings` models — replaced by the simpler household/profile model

## Capabilities

### New Capabilities
- `household-auth`: Supabase auth wiring (signup, login, OAuth, session management) with household account model
- `profile-management`: Profile CRUD, Netflix-style profile switcher, "add partner" flow
- `dual-path-persistence`: Real-time DB saves for authenticated users, localStorage fallback for anonymous, migration on signup
- `combined-household-view`: Merged financial data across profiles for dashboard and AI advisor context

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **Database schema**: Add `Profile` model; move all personal financial data (moneyType, moneyScripts, debts, incomeSources, spendingPlan, moneyDials) from `User` to `Profile`; remove `Partnership`, `PartnerInvite`, `PrivacySettings` models
- **Zustand flow store**: Abstract persistence layer to write to DB (authenticated) or localStorage (anonymous)
- **Middleware**: Already protects `/dashboard` and `/partner` routes; needs verification with new auth flow
- **Auth pages**: Wire `handleSubmit` and `handleGoogleSignUp` in signup/login pages to Supabase
- **Flow pages**: All 20+ pages using `useFlowStore` will work unchanged but benefit from DB persistence when authenticated
- **Dependencies**: `@supabase/ssr` and `@prisma/client` already installed; may need `@supabase/auth-helpers-nextjs` for anonymous auth
