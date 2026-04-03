# Tasks: Your Rich Life — Financial Wellness App

## Phase 1: Project Scaffolding & Foundation

### Task 1.1: Initialize Next.js project with App Router
- `npx create-next-app@latest . --typescript --tailwind --app --src-dir --eslint`
- Configure `tsconfig.json` path aliases (`@/` → `src/`)
- Install core dependencies: `prisma @prisma/client @supabase/supabase-js @supabase/ssr zustand recharts framer-motion @anthropic-ai/sdk`
- Install dev dependencies: `prettier prettier-plugin-tailwindcss`
- Create `.env.local` with placeholder vars: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`
- **Files**: `package.json`, `tsconfig.json`, `.env.local`, `.env.example`

### Task 1.2: Configure design system and global styles
- Install Google Fonts: Playfair Display (serif) + DM Sans (sans)
- Configure `next/font` in root layout for both fonts
- Set up Tailwind config with custom theme tokens (colors, typography, spacing, border-radius from design.md)
- Create `globals.css` with CSS custom properties for the warm palette
- Create base component styles (focus rings, transitions)
- **Files**: `src/app/layout.tsx`, `src/app/globals.css`, `tailwind.config.ts`

### Task 1.3: Create base UI component library
- `Button` — primary, secondary, ghost variants; warm styling
- `Card` — warm shadow, cream background, rounded-xl
- `Input` — text input with warm focus states
- `Slider` — custom range slider with warm accent colors
- `ProgressBar` — stepped progress for the guided flow
- `Badge` — pill badges for money types, categories
- `Modal` — accessible modal with backdrop
- `Tooltip` — hover tooltips for info icons
- All components: keyboard accessible, ARIA labels, Framer Motion where appropriate
- **Files**: `src/components/ui/*.tsx`

### Task 1.4: Set up Prisma schema and Supabase client
- Create `prisma/schema.prisma` with all models from design.md (User, MoneyScript, Debt, IncomeSource, SpendingPlan, MoneyDial, WholenessScore, AutomationItem, CheckIn, PartnerInvite, Partnership, RichLifeVision, MoneyRule, JointSpendingPlan, PrivacySettings)
- Create Supabase client utilities (`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`)
- Create auth middleware (`src/lib/supabase/middleware.ts`, `src/middleware.ts`)
- Run `npx prisma generate` to verify schema compiles
- **Files**: `prisma/schema.prisma`, `src/lib/supabase/*.ts`, `src/middleware.ts`

### Task 1.5: Set up Zustand stores with localStorage persistence
- Create `flow-store.ts` — full flow state (scripts, money type, debts, income, spending plan, money dials, current step, completion status)
- Create `partner-store.ts` — partner mode state (partnership data, shared debts, joint plan, onboarding step)
- Create `persist.ts` — sync layer that pushes localStorage data to Supabase when user authenticates
- **Files**: `src/lib/store/*.ts`

### Task 1.6: Create constants and type definitions
- `money-types.ts` — 4 types with names, descriptions, strengths, growth edges, partner dynamics
- `money-scripts.ts` — 5 fill-in-the-blank prompts
- `money-dials.ts` — 9 dial categories with names, descriptions, icons
- `csp-ranges.ts` — min/max for each bucket
- `author-wisdom.ts` — quotes mapped to money types and situations
- `credit-tips.ts` — contextual credit advice for nudges
- Type definitions: `src/types/flow.ts`, `src/types/debt.ts`, `src/types/partner.ts`, `src/types/dashboard.ts`
- **Files**: `src/lib/constants/*.ts`, `src/types/*.ts`

---

## Phase 2: Guided Onboarding Flow

### Task 2.1: Create flow layout with progress tracking
- Flow layout with stepped progress bar (5 steps)
- `StepWrapper` component — consistent padding, max-width, warm typography, Framer Motion page transitions (slide + fade)
- `FlowNavigation` — back/next buttons, auto-save on step change via Zustand persist
- Flow entry page that redirects to current step
- **Files**: `src/app/flow/layout.tsx`, `src/app/flow/page.tsx`, `src/components/flow/StepWrapper.tsx`, `src/components/flow/FlowNavigation.tsx`

### Task 2.2: Step 1 — Money Scripts page
- Display 5 fill-in-the-blank prompts (from `money-scripts.ts` constants)
- Each prompt is a `ScriptPrompt` component: the prompt text with a blank, a textarea for the user's response
- Warm, encouraging tone: "There are no wrong answers. This is just for you."
- Auto-save each response to Zustand store
- Validate: at least 3 of 5 filled before proceeding
- **Files**: `src/app/flow/scripts/page.tsx`, `src/components/flow/ScriptPrompt.tsx`

### Task 2.3: Step 1b — Money Type self-identification
- Display 4 `MoneyTypeCard` components (Optimizer, Avoider, Worrier, Dreamer)
- Each card shows: type name, brief description, strengths, growth edges
- User selects one — warm highlight on selection with Framer Motion scale
- Save to store; navigate to next step
- **Files**: `src/app/flow/money-type/page.tsx`, `src/components/flow/MoneyTypeCard.tsx`

### Task 2.4: Step 2 — Debt inventory
- `DebtEntryForm` — form to add a debt: name, balance, APR, minimum payment, type (dropdown of DebtType enum), credit limit (shown only for revolving types)
- `DebtList` — displays entered debts as cards, edit/delete actions
- Warm messaging: "No debt? That's amazing!" / "Debt isn't a moral failing. It's a tool that sometimes needs restructuring."
- Show running total and calculated aggregate utilization for revolving debts
- Auto-save to Zustand on each add/edit/delete
- **Files**: `src/app/flow/debts/page.tsx`, `src/components/flow/DebtEntryForm.tsx`, `src/components/flow/DebtList.tsx`

### Task 2.5: Step 2b — Income sources
- `IncomeEntryForm` — add income source: name, monthly amount, is-after-tax toggle
- Display list of entered sources with total monthly income
- Save to store; this total feeds the CSP step
- **Files**: `src/app/flow/income/page.tsx`, `src/components/flow/IncomeEntryForm.tsx`

### Task 2.6: Step 3 — Conscious Spending Plan
- `CSPSliders` — 4 interactive sliders (Fixed Costs, Savings, Investments, Guilt-Free)
- Each slider constrained to its range (50-60, 5-10, 5-10, 20-35)
- Remaining/over indicator showing distance from 100%
- "Balance" button to auto-distribute remaining proportionally
- `CSPBucketCard` — shows each bucket with percentage AND dollar amount (calculated from total income)
- Dollar amounts update live as sliders move
- Must total exactly 100% to proceed
- Save to store
- **Files**: `src/app/flow/spending-plan/page.tsx`, `src/components/flow/CSPSliders.tsx`, `src/components/flow/CSPBucketCard.tsx`

### Task 2.7: Step 4 — Money Dials
- `MoneyDialsGrid` — grid of 9 dial categories from constants
- `MoneyDialSlider` — each dial has name, description, 1-10 slider
- Explain concept: "Cut mercilessly on what you don't care about, spend extravagantly on what you love."
- Save dial levels to store
- **Files**: `src/app/flow/money-dials/page.tsx`, `src/components/flow/MoneyDialsGrid.tsx`, `src/components/flow/MoneyDialSlider.tsx`

### Task 2.8: Step 5 — Plan summary dashboard
- Pull all data from Zustand store and render the complete summary
- `WholenessScoreRing` — animated circular progress (0-100%)
- CSP breakdown with bucket cards showing percentages and dollar amounts
- Debt payoff strategy comparison — call server-side calculation API, show Snowball vs Avalanche vs Utilization-First with projected dates and total interest
- `CreditHealthCard` — estimated utilization %, biggest opportunity factor, simple indicator
- `AutomationChecklist` — generated list of automation items based on user's debts and plan (auto-pay minimums, savings transfers, investment transfers, credit monitoring)
- `AuthorQuote` — personalized wisdom based on their money type
- `SavePrompt` — prompt to create account to save their plan permanently
- **Files**: `src/app/flow/summary/page.tsx`, `src/components/dashboard/WholenessScoreRing.tsx`, `src/components/dashboard/CSPOverview.tsx`, `src/components/dashboard/CreditHealthCard.tsx`, `src/components/dashboard/AutomationChecklist.tsx`, `src/components/shared/AuthorQuote.tsx`, `src/components/shared/SavePrompt.tsx`

---

## Phase 3: Financial Calculation Engine

### Task 3.1: Debt payoff calculation engine
- Implement three strategies in `src/lib/calculations/debt-payoff.ts`:
  - **Avalanche**: sort by APR descending, pay minimums on all, extra to highest APR
  - **Snowball**: sort by balance ascending, pay minimums on all, extra to lowest balance
  - **Utilization-First**: sort revolving by utilization descending (balance/limit), pay minimums on all, extra to highest utilization; installment debts after all revolving
- Each strategy produces: month-by-month schedule per debt, total interest paid, total months to payoff, utilization milestones (per revolving account crossing 30%, 10%, 7% thresholds)
- Handle: compound interest, minimum payment adjustments as balances decrease, extra payment waterfall (when one debt paid off, its payment rolls to next)
- **Files**: `src/lib/calculations/debt-payoff.ts`, `src/lib/calculations/amortization.ts`

### Task 3.2: Credit health calculations
- `credit-health.ts`: aggregate utilization ratio, per-card utilization, utilization category (optimal <7%, good <10%, acceptable <30%, high >30%)
- Payment automation coverage ratio
- Debt mix analysis (count of revolving vs installment types)
- Generate contextual nudge messages based on current state
- **Files**: `src/lib/calculations/credit-health.ts`

### Task 3.3: Wholeness score algorithm
- Implement Tiffany Aliche's 10-step framework as a scoring algorithm
- Each step 0-10 points, total 0-100:
  1. Budget (has CSP) — points for having a plan, bonus for balanced allocation
  2. Save (savings % in CSP) — points scaled by savings percentage
  3. Pay off debt (debt progress) — points for having a payoff plan, bonus for low utilization
  4. Build credit — points for: utilization-aware payoff plan, automated payments, credit report check
  5. Increase income — points for multiple income sources
  6. Retire (investments %) — points scaled by investment percentage
  7. Invest for wealth — bonus points for investment allocation above minimum
  8. Get insured — placeholder (user self-report in future)
  9. Grow net worth — derived from income vs debt trajectory
  10. Leave a legacy — placeholder (aspirational, ties to Rich Life Vision)
- **Files**: `src/lib/calculations/wholeness-score.ts`

### Task 3.4: CSP calculation helpers
- Dollar amounts from percentages and total income
- Validation: total must equal 100%
- Remaining/over calculation
- Proportional auto-balance function
- **Files**: `src/lib/calculations/csp.ts`

### Task 3.5: Create API routes for calculations
- `POST /api/calculations/debt-payoff` — accepts debts array + extra monthly payment, returns all three strategies
- `POST /api/calculations/credit-health` — accepts debts array, returns utilization snapshot
- `POST /api/calculations/wholeness-score` — accepts full user data, returns scored breakdown
- **Files**: `src/app/api/calculations/debt-payoff/route.ts`, `src/app/api/calculations/credit-health/route.ts`, `src/app/api/calculations/wholeness-score/route.ts`

---

## Phase 4: Standalone Debt Payoff Calculator

### Task 4.1: Build the calculator page
- Standalone page at `/calculator` — works without auth
- `DebtInputTable` — add/edit/remove debts inline
- `ExtraPaymentSlider` — slider for extra monthly payment amount
- `StrategyComparison` — 3-column comparison (Snowball, Avalanche, Utilization-First) showing total interest, payoff date, months saved
- `AmortizationChart` — Recharts area/line chart showing balance over time for selected strategy
- `UtilizationTimeline` — milestones on the payoff timeline (30%, 10%, 7% thresholds)
- Calls `/api/calculations/debt-payoff` on input change (debounced)
- **Files**: `src/app/calculator/page.tsx`, `src/components/calculator/DebtInputTable.tsx`, `src/components/calculator/ExtraPaymentSlider.tsx`, `src/components/calculator/StrategyComparison.tsx`, `src/components/calculator/AmortizationChart.tsx`, `src/components/calculator/UtilizationTimeline.tsx`

---

## Phase 5: Authentication & Data Persistence

### Task 5.1: Auth pages and flow
- Login page with email + Google OAuth via Supabase Auth
- Signup page with same options
- OAuth callback route handler
- Auth state provider wrapping the app
- Protected route middleware: `/dashboard/*` and `/partner/*` require auth
- **Files**: `src/app/auth/login/page.tsx`, `src/app/auth/signup/page.tsx`, `src/app/auth/callback/route.ts`, `src/middleware.ts`

### Task 5.2: localStorage → Supabase sync
- On sign-up/login: detect if localStorage has flow data
- Push local data to Supabase via Prisma (create User + related records)
- Clear localStorage after successful sync
- On subsequent visits: load from Supabase if authenticated, localStorage if not
- Handle conflict: Supabase data wins if it exists (user may have synced from another device)
- **Files**: `src/lib/store/persist.ts` (update), create server actions in `src/app/actions/sync.ts`

---

## Phase 6: Persistent Dashboard

### Task 6.1: Main dashboard page
- Auth-required page at `/dashboard`
- Layout with sidebar nav (desktop) / bottom nav (mobile)
- `WholenessScoreRing` — current score with breakdown on hover/tap
- `CSPOverview` — current spending plan summary
- `DebtPayoffChart` — Recharts line chart of debt trajectory
- `CreditHealthCard` — utilization trend, payment streak, report check reminder
- `MonthlyCheckInPrompt` — card prompting monthly review (Ramit: <1 hour/month on money)
- **Files**: `src/app/dashboard/page.tsx`, `src/app/dashboard/layout.tsx`, `src/components/dashboard/DebtPayoffChart.tsx`, `src/components/dashboard/MonthlyCheckInPrompt.tsx`

### Task 6.2: Dashboard debt tracking page
- `/dashboard/debts` — view and update debt balances over time
- Edit existing debts, mark as paid off (celebrate!)
- Show payoff progress vs original projection
- Credit health improvements as debts decrease
- **Files**: `src/app/dashboard/debts/page.tsx`

### Task 6.3: Monthly check-in page
- `/dashboard/check-in` — guided monthly reflection
- Prompts: what went well, what felt hard, what to adjust
- Credit-relevant prompts: utilization thresholds crossed, credit report check
- Save responses, call AI for synthesis
- **Files**: `src/app/dashboard/check-in/page.tsx`

---

## Phase 7: AI Features

### Task 7.1: AI client and prompt system
- Create Anthropic SDK client wrapper (`src/lib/ai/client.ts`)
- Define system prompts for each feature (`src/lib/ai/prompts.ts`):
  - Script Reflection: warm, therapeutic, channeling Tiffany Aliche + Ramit Sethi
  - Plan Review: personalized suggestions with credit health observations
  - Monthly Check-In: synthesis of partner's monthly reflection
  - Couples Counselor: neutral mediator persona (see spec)
- Define request/response types (`src/lib/ai/types.ts`)
- **Files**: `src/lib/ai/*.ts`

### Task 7.2: Script Reflection API + UI
- `POST /api/ai/script-reflection` — accepts 5 script responses + money type, returns warm reflection
- Integrate into flow: after completing scripts, show "Would you like a reflection?" button
- Display AI response in a warm card with author attribution
- **Files**: `src/app/api/ai/script-reflection/route.ts`, update `src/app/flow/scripts/page.tsx`

### Task 7.3: Plan Review API + UI
- `POST /api/ai/plan-review` — accepts full financial picture, returns personalized review
- Available on the summary page and dashboard
- Includes credit health observations (utilization, debt mix, automation coverage)
- **Files**: `src/app/api/ai/plan-review/route.ts`

### Task 7.4: Monthly Check-In AI
- `POST /api/ai/monthly-checkin` — accepts check-in responses + historical data, returns synthesis
- Integrate into check-in page: AI summary appears after submitting responses
- **Files**: `src/app/api/ai/monthly-checkin/route.ts`, update `src/app/dashboard/check-in/page.tsx`

---

## Phase 8: Partner Mode

### Task 8.1: Partner invite and linking system
- Invite page: send invite via email, shows pending invites
- Accept/decline invite flow
- API routes: `POST /api/partner/invite`, `POST /api/partner/link`, `POST /api/partner/unlink`
- Unlink is instant, either partner can do it, clean data separation
- Supabase RLS policies for partnership data access
- **Files**: `src/app/partner/invite/page.tsx`, `src/app/api/partner/*.ts`

### Task 8.2: Couples onboarding — Steps 1-3
- Step 1: `TypeComparison` — side-by-side money types with AI-generated compatibility insight
- Step 2: `VisionVennDiagram` — each partner enters values/vision, app shows overlaps visually, AI synthesizes
- Step 3: `MoneyRulesForm` — prompted negotiation of money rules (spending threshold, review cadence, personal allowance, priorities, credit usage, custom)
- Async-friendly: show pending states when waiting for partner
- **Files**: `src/app/partner/onboarding/layout.tsx`, `src/app/partner/onboarding/types/page.tsx`, `src/app/partner/onboarding/vision/page.tsx`, `src/app/partner/onboarding/rules/page.tsx`, `src/components/partner/TypeComparison.tsx`, `src/components/partner/VisionVennDiagram.tsx`, `src/components/partner/MoneyRulesForm.tsx`, `src/components/partner/PartnerPendingState.tsx`

### Task 8.3: Couples onboarding — Steps 4-6
- Step 4: `SharedDebtMapper` — flag which debts are shared, create combined view
- Step 5: `JointCSPSliders` — joint pool calculation (household income minus personal allocations), 4-bucket sliders for joint pool, show where each partner's solo preferences were
- Step 6: Joint summary — household wholeness score, joint CSP, shared debt payoff, combined credit health, two-column automation checklist, Rich Life Vision, Money Rules
- **Files**: `src/app/partner/onboarding/shared-debts/page.tsx`, `src/app/partner/onboarding/joint-plan/page.tsx`, `src/app/partner/onboarding/summary/page.tsx`, `src/components/partner/SharedDebtMapper.tsx`, `src/components/partner/JointCSPSliders.tsx`

### Task 8.4: AI Couples Counselor
- `POST /api/ai/couples-counselor` — accepts conversation context + both partners' shared data (respecting privacy settings), returns counselor response
- Chat interface at `/partner/counselor` — real-time conversation with the AI counselor
- Counselor activates during onboarding synthesis, monthly check-ins, on-demand disputes
- Privacy enforcement: API route filters data based on `PrivacySettings` before constructing AI prompt
- **Files**: `src/app/partner/counselor/page.tsx`, `src/components/partner/CounselorChat.tsx`, `src/app/api/ai/couples-counselor/route.ts`

---

## Phase 9: Credit Nudges & Contextual Intelligence

### Task 9.1: Credit nudge system
- `CreditNudge` component — warm, contextual credit advice that appears throughout the app
- Rule-based engine in `src/lib/constants/credit-tips.ts` that selects appropriate nudges based on:
  - Current utilization ratio
  - Number of automated payments vs total accounts
  - Debt types present
  - Recent milestones (card dropping below threshold)
- Integration points: debt inventory step, summary page, dashboard, automation checklist, monthly check-in
- **Files**: `src/components/shared/CreditNudge.tsx`, update `src/lib/constants/credit-tips.ts`

---

## Phase 10: Polish & Accessibility

### Task 10.1: Animations and transitions
- Framer Motion page transitions for flow steps (slide + fade)
- Slider interaction animations (spring physics)
- Score ring fill animation
- Card entrance stagger on dashboard
- Celebration animations for milestones (debt paid off, score improvement)
- Respect `prefers-reduced-motion`
- **Files**: `src/components/shared/AnimatedTransition.tsx`, update components throughout

### Task 10.2: Accessibility audit and fixes
- Keyboard navigation for all interactive elements
- ARIA labels on custom components (sliders, progress, charts)
- Focus management during flow navigation
- Screen reader announcements for dynamic content (score updates, nudges)
- Color contrast verification on warm palette (minimum 4.5:1 for body text)
- Skip-to-content link
- **Files**: Updates across all components

### Task 10.3: Mobile responsiveness pass
- Verify all pages work at 320px minimum width
- Flow pages: single column, full-width inputs
- Dashboard: stack cards vertically on mobile, bottom navigation
- Calculator: responsive table → card layout on mobile
- Partner onboarding: works solo on phone (async-friendly)
- Touch targets minimum 44px
- **Files**: Updates across all pages and components

### Task 10.4: Landing page
- Marketing/intro page at `/` explaining the app's philosophy
- Warm, editorial design matching the app aesthetic
- Clear CTAs: "Start Your Rich Life" → flow, "Calculate Debt Payoff" → calculator
- Brief explanation of the four frameworks
- Mobile-optimized
- **Files**: `src/app/page.tsx`
