## Context

The app has a complete financial wellness flow (money scripts → money type → debts → income → spending plan → money dials → summary) stored in a Zustand store with localStorage persistence. Supabase is configured (browser + server clients, middleware) but auth handlers are stubbed. The Prisma schema has a `User` model that directly owns all financial data, plus `Partnership`/`PartnerInvite`/`PrivacySettings` models for a couples feature that was designed around two separate accounts.

The new direction is a **household account model** — one shared login, multiple profiles, no privacy barriers within the household.

## Goals / Non-Goals

**Goals:**
- Wire Supabase auth end-to-end (email/password signup, login, Google OAuth)
- Introduce `Profile` model so one account can hold multiple financial personas
- Enable signup before flow entry to prevent partial work loss via real-time DB persistence
- Maintain the existing anonymous flow (localStorage) as a valid path
- Migrate localStorage data to a Profile on signup
- Netflix-style profile switcher for households with 2+ profiles
- Combined household view with merged financials for dashboard and AI

**Non-Goals:**
- Anonymous Supabase auth (adds complexity; localStorage is fine for anonymous users)
- Multi-household support (one account = one household)
- Partner-specific permissions or privacy controls (everything shared)
- AI advisor implementation (will consume the profile data but is a separate change)
- Email verification flow (can be added later; keep signup instant)
- Password reset flow (defer to a follow-up change)

## Decisions

### 1. Profile model instead of Partnership

**Decision:** Replace `Partnership`, `PartnerInvite`, and `PrivacySettings` with a `Profile` model. All personal financial data moves from `User` to `Profile`.

**Why:** The original model assumed two separate accounts linked by invites. The household model is simpler — one account owns 1-2 profiles. No invite flow, no privacy settings, no linking logic.

**Schema change:**
```prisma
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  name      String?   // household name, e.g. "The Smiths"
  profiles  Profile[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Profile {
  id             String          @id @default(uuid())
  userId         String
  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  name           String          // "Marcus", "Tanya"
  isDefault      Boolean         @default(false)
  moneyType      MoneyType?
  moneyScripts   MoneyScript[]
  debts          Debt[]
  incomeSources  IncomeSource[]
  spendingPlan   SpendingPlan?
  moneyDials     MoneyDial[]
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  @@index([userId])
}
```

All existing models that reference `userId` (Debt, IncomeSource, MoneyScript, SpendingPlan, MoneyDial) change to reference `profileId` instead.

**Alternative considered:** Keep `User` owning data directly and add a `HouseholdMember` join table. Rejected because it adds indirection without benefit — Profile is cleaner.

### 2. Dual-path persistence via store abstraction

**Decision:** The Zustand flow store gains an async persistence adapter. When authenticated, writes go to the DB via server actions. When anonymous, writes go to localStorage (existing behavior).

**Why:** The flow UI should be identical regardless of auth state. The store is the single interface; only the backend differs.

**Approach:**
```
useFlowStore.setState(update)
  └──▶ persist middleware
        ├── isAuthenticated? → call server action (debounced)
        └── !authenticated?  → write to localStorage (existing)
```

The server action receives partial updates and upserts to the active Profile. Debounce writes (500ms) to avoid hammering the DB on rapid input changes.

**Alternative considered:** Replace Zustand entirely with React Query + server state. Rejected because 20+ pages already use `useFlowStore` — wrapping persistence is far less disruptive.

### 3. Signup creates first Profile automatically

**Decision:** On signup, the system creates a `User` + one `Profile` in a single transaction. The profile name comes from the signup form's "Name" field.

**Why:** Solo users should never see profile management. Their account just works. The profile switcher only appears when a second profile is added.

**Flow:**
```
Signup form (name, email, password)
  → supabase.auth.signUp()
  → on success: server action creates User + Profile via Prisma
  → if localStorage has flow data: migrate it to the new Profile
  → redirect to /flow (continue where they left off) or /dashboard (if flow complete)
```

### 4. Profile switcher as a client component

**Decision:** A `<ProfileSwitcher>` component in the app shell. It reads profiles from the authenticated user and sets the active profile ID in a cookie/context.

**Why:** The active profile needs to be available on both client and server. A cookie makes it readable in middleware and server components. Client context makes it reactive.

**Behavior:**
- 1 profile: component is hidden, profile is auto-selected
- 2 profiles: shows both with active indicator, click to switch
- Max 2 profiles per account (household = max 2 people)

### 5. localStorage migration on signup

**Decision:** When an anonymous user signs up, the client reads localStorage flow data and sends it to a `migrateFlowData` server action that populates the new Profile.

**Why:** Users who completed the flow anonymously shouldn't have to redo it. The localStorage shape matches the server action input shape (already defined in `syncFlowData`).

**After migration:** Clear the localStorage `rich-life-flow` key to avoid stale data conflicts.

### 6. Combined household view is derived, not stored

**Decision:** The combined/merged financial view is computed at query time by aggregating across all profiles in the household. No separate "household" data model.

**Why:** Storing derived data creates sync issues. Querying across 2 profiles is trivial and always fresh.

**Example query pattern:**
```sql
SELECT SUM(balance) as total_debt
FROM "Debt"
WHERE "profileId" IN (SELECT id FROM "Profile" WHERE "userId" = $1)
```

### 7. Keep existing auth callback route for OAuth

**Decision:** Wire the existing `/auth/callback/route.ts` to handle the Supabase OAuth code exchange.

**Why:** The route already exists (empty). Supabase OAuth redirects here after Google sign-in. Just needs the standard `exchangeCodeForSession` implementation.

## Risks / Trade-offs

**[Risk] localStorage data shape diverges from DB schema** → Mitigation: The migration action validates and transforms data. If localStorage has unexpected shape, log a warning and start fresh rather than crashing.

**[Risk] Two people editing the same profile simultaneously** → Mitigation: Last-write-wins is acceptable for this use case. Couples won't be editing the same profile at the same time (they each have their own). If they're both on the same profile, the data is the same intent anyway.

**[Risk] Supabase user ID vs Prisma User ID mismatch** → Mitigation: Use the Supabase `auth.uid()` as the Prisma User `id`. One ID, no mapping table.

**[Trade-off] Max 2 profiles is a hard limit** → Acceptable for the household model. If multi-generational households become a use case, this can be revisited.

**[Trade-off] No email verification on signup** → Keeps signup instant (goal), but means anyone can sign up with any email. Acceptable for MVP; add verification later.

## Resolved Questions

- **"Add partner" prompt location:** Both the flow summary page and the dashboard.
- **WholenessScore, AutomationItem, CheckIn:** Stay on `User` (household-level). These are shared household concerns, not individual profile data.
