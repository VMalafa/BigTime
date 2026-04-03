# Design: Your Rich Life — Financial Wellness App

## Architecture Overview

Next.js 14 App Router application with Supabase (Postgres + Auth), Prisma ORM, Tailwind CSS, Recharts, Framer Motion, and Claude API.

```
┌─────────────────────────────────────────────────┐
│                   Next.js App                    │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Guided   │  │Dashboard │  │  Debt Payoff │  │
│  │  Flow UI  │  │   UI     │  │  Calculator  │  │
│  └─────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│        │              │               │          │
│  ┌─────┴──────────────┴───────────────┴───────┐  │
│  │          React Context (FlowStore)         │  │
│  │    localStorage ←→ Supabase sync layer     │  │
│  └─────────────────────┬──────────────────────┘  │
│                        │                         │
│  ┌─────────────────────┴──────────────────────┐  │
│  │         Next.js API Routes / Actions       │  │
│  │  • Financial calculations (server-side)    │  │
│  │  • Claude API proxy                        │  │
│  │  • Partner Mode operations                 │  │
│  └─────────────────────┬──────────────────────┘  │
│                        │                         │
│  ┌─────────────────────┴──────────────────────┐  │
│  │     Supabase (Postgres + Auth + RLS)       │  │
│  │     Prisma ORM                             │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout with providers, fonts
│   ├── page.tsx                      # Landing / marketing page
│   ├── globals.css                   # Tailwind + custom theme tokens
│   │
│   ├── flow/                         # Guided onboarding flow
│   │   ├── layout.tsx                # Flow layout with progress bar
│   │   ├── page.tsx                  # Flow entry / redirect to step 1
│   │   ├── scripts/page.tsx          # Step 1: Money Scripts
│   │   ├── money-type/page.tsx       # Step 1b: Money Type quiz
│   │   ├── debts/page.tsx            # Step 2: Debt inventory
│   │   ├── income/page.tsx           # Step 2b: Income sources
│   │   ├── spending-plan/page.tsx    # Step 3: CSP sliders
│   │   ├── money-dials/page.tsx      # Step 4: Money Dials
│   │   └── summary/page.tsx          # Step 5: Plan summary
│   │
│   ├── dashboard/                    # Persistent dashboard (auth required)
│   │   ├── page.tsx                  # Main dashboard
│   │   ├── debts/page.tsx            # Debt payoff tracking
│   │   ├── check-in/page.tsx         # Monthly check-in
│   │   └── settings/page.tsx         # Account + partner settings
│   │
│   ├── partner/                      # Partner Mode
│   │   ├── invite/page.tsx           # Send/accept invite
│   │   ├── onboarding/
│   │   │   ├── layout.tsx            # Couples flow layout
│   │   │   ├── types/page.tsx        # Step 1: Share Money Types
│   │   │   ├── vision/page.tsx       # Step 2: Rich Life Vision
│   │   │   ├── rules/page.tsx        # Step 3: Money Rules
│   │   │   ├── shared-debts/page.tsx # Step 4: Map shared debts
│   │   │   ├── joint-plan/page.tsx   # Step 5: Joint CSP
│   │   │   └── summary/page.tsx      # Step 6: Joint summary
│   │   └── counselor/page.tsx        # AI Couples Counselor chat
│   │
│   ├── calculator/                   # Standalone debt payoff calculator
│   │   └── page.tsx
│   │
│   ├── auth/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── callback/route.ts         # OAuth callback
│   │
│   └── api/
│       ├── ai/
│       │   ├── script-reflection/route.ts
│       │   ├── plan-review/route.ts
│       │   ├── monthly-checkin/route.ts
│       │   └── couples-counselor/route.ts
│       ├── calculations/
│       │   ├── debt-payoff/route.ts   # Amortization projections
│       │   ├── credit-health/route.ts # Utilization calculations
│       │   └── wholeness-score/route.ts
│       └── partner/
│           ├── invite/route.ts
│           ├── link/route.ts
│           └── unlink/route.ts
│
├── components/
│   ├── ui/                           # Base UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Slider.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── Badge.tsx
│   │   └── Tooltip.tsx
│   │
│   ├── flow/                         # Guided flow components
│   │   ├── ScriptPrompt.tsx          # Single money script prompt
│   │   ├── MoneyTypeCard.tsx         # Money type selection card
│   │   ├── DebtEntryForm.tsx         # Add/edit a debt
│   │   ├── DebtList.tsx              # List of entered debts
│   │   ├── IncomeEntryForm.tsx       # Add/edit income source
│   │   ├── CSPSliders.tsx            # 4-bucket slider system
│   │   ├── CSPBucketCard.tsx         # Individual bucket display
│   │   ├── MoneyDialSlider.tsx       # Single money dial
│   │   ├── MoneyDialsGrid.tsx        # Grid of all dials
│   │   ├── FlowNavigation.tsx        # Next/back buttons
│   │   └── StepWrapper.tsx           # Layout wrapper for each step
│   │
│   ├── dashboard/                    # Dashboard components
│   │   ├── WholenessScoreRing.tsx    # Circular progress for score
│   │   ├── CSPOverview.tsx           # Spending plan summary
│   │   ├── DebtPayoffChart.tsx       # Payoff timeline chart
│   │   ├── CreditHealthCard.tsx      # Credit health snapshot
│   │   ├── AutomationChecklist.tsx   # Automation items
│   │   └── MonthlyCheckInPrompt.tsx
│   │
│   ├── partner/                      # Partner Mode components
│   │   ├── TypeComparison.tsx        # Side-by-side money types
│   │   ├── VisionVennDiagram.tsx     # Overlapping values viz
│   │   ├── MoneyRulesForm.tsx        # Negotiate rules
│   │   ├── JointCSPSliders.tsx       # Joint spending plan
│   │   ├── SharedDebtMapper.tsx      # Flag shared debts
│   │   ├── CounselorChat.tsx         # AI counselor interface
│   │   └── PartnerPendingState.tsx   # Async waiting states
│   │
│   ├── calculator/                   # Debt calculator components
│   │   ├── DebtInputTable.tsx
│   │   ├── StrategyComparison.tsx    # Snowball vs Avalanche vs Util
│   │   ├── ExtraPaymentSlider.tsx
│   │   ├── AmortizationChart.tsx
│   │   └── UtilizationTimeline.tsx   # Utilization milestones
│   │
│   └── shared/                       # Shared components
│       ├── AuthorQuote.tsx           # Wisdom from the four authors
│       ├── CreditNudge.tsx           # Contextual credit nudges
│       ├── SavePrompt.tsx            # Prompt to create account
│       └── AnimatedTransition.tsx    # Framer Motion wrappers
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser client
│   │   ├── server.ts                 # Server client
│   │   └── middleware.ts             # Auth middleware
│   │
│   ├── calculations/
│   │   ├── debt-payoff.ts            # Snowball, Avalanche, Utilization-First
│   │   ├── amortization.ts           # Compound interest, payment schedules
│   │   ├── credit-health.ts          # Utilization ratios, score factors
│   │   ├── wholeness-score.ts        # 10-step scoring algorithm
│   │   └── csp.ts                    # Conscious Spending Plan math
│   │
│   ├── ai/
│   │   ├── client.ts                 # Anthropic SDK client
│   │   ├── prompts.ts                # System prompts for each AI feature
│   │   └── types.ts                  # AI request/response types
│   │
│   ├── store/
│   │   ├── flow-store.ts             # Zustand store for flow state
│   │   ├── partner-store.ts          # Zustand store for partner state
│   │   └── persist.ts                # localStorage ←→ Supabase sync
│   │
│   ├── constants/
│   │   ├── money-types.ts            # Type definitions + descriptions
│   │   ├── money-scripts.ts          # 5 script prompts
│   │   ├── money-dials.ts            # Dial categories
│   │   ├── csp-ranges.ts             # Bucket min/max percentages
│   │   ├── author-wisdom.ts          # Quotes mapped to types/situations
│   │   └── credit-tips.ts            # Contextual credit advice
│   │
│   └── utils/
│       ├── format.ts                 # Currency, percentage formatting
│       └── validation.ts             # Form validation helpers
│
├── prisma/
│   └── schema.prisma                 # Database schema
│
└── types/
    ├── flow.ts                       # Flow state types
    ├── debt.ts                       # Debt-related types
    ├── partner.ts                    # Partner mode types
    └── dashboard.ts                  # Dashboard types
```

## Data Models (Prisma Schema)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Users & Auth ────────────────────────────────

model User {
  id              String    @id @default(uuid())
  email           String    @unique
  name            String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Solo flow data
  moneyType       MoneyType?
  moneyScripts    MoneyScript[]
  debts           Debt[]
  incomeSources   IncomeSource[]
  spendingPlan    SpendingPlan?
  moneyDials      MoneyDial[]
  wholenessScore  WholenessScore?
  automationItems AutomationItem[]
  checkIns        CheckIn[]

  // Partner Mode
  partnershipA    Partnership?  @relation("partnerA")
  partnershipB    Partnership?  @relation("partnerB")
  partnerInvitesSent     PartnerInvite[] @relation("inviteSender")
  partnerInvitesReceived PartnerInvite[] @relation("inviteRecipient")

  // Privacy controls
  privacySettings PrivacySettings?
}

enum MoneyType {
  OPTIMIZER
  AVOIDER
  WORRIER
  DREAMER
}

// ─── Money Scripts ───────────────────────────────

model MoneyScript {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  promptId  Int      // 1-5, maps to the 5 prompts
  response  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // AI reflection (generated after all 5 complete)
  aiReflection String?

  @@unique([userId, promptId])
}

// ─── Debts ───────────────────────────────────────

model Debt {
  id             String    @id @default(uuid())
  userId         String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name           String    // "Chase Visa", "Student Loan", etc.
  balance        Decimal   @db.Decimal(12, 2)
  apr            Decimal   @db.Decimal(5, 3) // e.g., 24.990
  minimumPayment Decimal   @db.Decimal(10, 2)
  debtType       DebtType
  creditLimit    Decimal?  @db.Decimal(12, 2) // Only for revolving
  isShared       Boolean   @default(false)    // Flagged in Partner Mode
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([userId])
}

enum DebtType {
  CREDIT_CARD
  PERSONAL_LOAN
  STUDENT_LOAN
  AUTO_LOAN
  MORTGAGE
  MEDICAL
  OTHER_REVOLVING
  OTHER_INSTALLMENT
}

// ─── Income ──────────────────────────────────────

model IncomeSource {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String   // "Salary", "Freelance", etc.
  monthlyAmount Decimal  @db.Decimal(12, 2)
  isAfterTax    Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId])
}

// ─── Conscious Spending Plan ─────────────────────

model SpendingPlan {
  id                   String   @id @default(uuid())
  userId               String   @unique
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  fixedCostsPercent    Int      // 50-60
  savingsPercent       Int      // 5-10
  investmentsPercent   Int      // 5-10
  guiltFreePercent     Int      // 20-35
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}

// ─── Money Dials ─────────────────────────────────

model MoneyDial {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  category  DialCategory
  level     Int      // 1-10 intensity
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, category])
}

enum DialCategory {
  TRAVEL
  FOOD_DINING
  HEALTH_FITNESS
  CONVENIENCE
  TECHNOLOGY
  FASHION
  EXPERIENCES
  EDUCATION
  GIVING
}

// ─── Wholeness Score ─────────────────────────────

model WholenessScore {
  id                  String   @id @default(uuid())
  userId              String   @unique
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  budgetScore         Int      @default(0) // 0-10 each
  saveScore           Int      @default(0)
  debtScore           Int      @default(0)
  creditScore         Int      @default(0)
  incomeScore         Int      @default(0)
  retirementScore     Int      @default(0)
  wealthScore         Int      @default(0)
  insuranceScore      Int      @default(0)
  netWorthScore       Int      @default(0)
  legacyScore         Int      @default(0)
  totalScore          Int      @default(0) // 0-100
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

// ─── Automation Checklist ────────────────────────

model AutomationItem {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  description String?
  isCompleted Boolean  @default(false)
  category    AutomationCategory
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
}

enum AutomationCategory {
  BILL_PAY
  SAVINGS_TRANSFER
  INVESTMENT_TRANSFER
  CREDIT_PROTECTION
  CREDIT_MONITORING
}

// ─── Monthly Check-Ins ───────────────────────────

model CheckIn {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  month           DateTime // First of the month
  wentWell        String?
  feltHard        String?
  toAdjust        String?
  creditWins      String?
  aiSummary       String?  // AI-generated synthesis
  createdAt       DateTime @default(now())

  @@unique([userId, month])
}

// ─── Partner Mode ────────────────────────────────

model PartnerInvite {
  id          String       @id @default(uuid())
  senderId    String
  sender      User         @relation("inviteSender", fields: [senderId], references: [id])
  recipientId String?
  recipient   User?        @relation("inviteRecipient", fields: [recipientId], references: [id])
  email       String       // Invite sent to this email
  status      InviteStatus @default(PENDING)
  createdAt   DateTime     @default(now())
  expiresAt   DateTime     // 7-day expiry

  @@index([email])
}

enum InviteStatus {
  PENDING
  ACCEPTED
  DECLINED
  EXPIRED
}

model Partnership {
  id              String   @id @default(uuid())
  partnerAId      String   @unique
  partnerA        User     @relation("partnerA", fields: [partnerAId], references: [id])
  partnerBId      String   @unique
  partnerB        User     @relation("partnerB", fields: [partnerBId], references: [id])
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  unlinkedAt      DateTime?

  // Couples onboarding state
  onboardingStep  Int      @default(0)

  // Shared data
  richLifeVision  RichLifeVision?
  moneyRules      MoneyRule[]
  jointPlan       JointSpendingPlan?

  @@index([partnerAId])
  @@index([partnerBId])
}

model RichLifeVision {
  id              String      @id @default(uuid())
  partnershipId   String      @unique
  partnership     Partnership @relation(fields: [partnershipId], references: [id], onDelete: Cascade)
  partnerAVision  Json        // { year1, year5, year10, values[] }
  partnerBVision  Json        // { year1, year5, year10, values[] }
  sharedVision    String?     // AI-synthesized overlap
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

model MoneyRule {
  id              String      @id @default(uuid())
  partnershipId   String
  partnership     Partnership @relation(fields: [partnershipId], references: [id], onDelete: Cascade)
  ruleText        String
  ruleType        RuleType
  agreedByA       Boolean     @default(false)
  agreedByB       Boolean     @default(false)
  createdAt       DateTime    @default(now())

  @@index([partnershipId])
}

enum RuleType {
  SPENDING_THRESHOLD
  REVIEW_CADENCE
  PERSONAL_ALLOWANCE
  PRIORITY
  CREDIT_USAGE
  CUSTOM
}

model JointSpendingPlan {
  id                       String      @id @default(uuid())
  partnershipId            String      @unique
  partnership              Partnership @relation(fields: [partnershipId], references: [id], onDelete: Cascade)
  totalHouseholdIncome     Decimal     @db.Decimal(12, 2)
  partnerAPersonalAmount   Decimal     @db.Decimal(10, 2)
  partnerBPersonalAmount   Decimal     @db.Decimal(10, 2)
  jointFixedCostsPercent   Int
  jointSavingsPercent      Int
  jointInvestmentsPercent  Int
  jointGuiltFreePercent    Int
  createdAt                DateTime    @default(now())
  updatedAt                DateTime    @updatedAt
}

// ─── Privacy Settings ────────────────────────────

model PrivacySettings {
  id                   String  @id @default(uuid())
  userId               String  @unique
  user                 User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  shareScripts         Boolean @default(false)
  shareIndividualDebts Boolean @default(false)
  shareIncomeDetail    Boolean @default(false) // false = only total visible
  shareMoneyDials      Boolean @default(false)
}
```

## Key Design Decisions

### 1. localStorage-First Flow with Sync

The guided flow works entirely with localStorage (via Zustand `persist` middleware) so users can complete it without authentication. A sync layer detects when the user signs up and pushes local data to Supabase. This is critical for conversion — removing the auth gate from the core experience.

**Store shape** (Zustand):
```typescript
interface FlowState {
  currentStep: number
  scripts: Record<number, string>       // promptId → response
  moneyType: MoneyType | null
  debts: Debt[]
  incomeSources: IncomeSource[]
  spendingPlan: SpendingPlanData | null
  moneyDials: Record<DialCategory, number>
  isComplete: boolean
  // actions
  setScript: (promptId: number, response: string) => void
  setMoneyType: (type: MoneyType) => void
  addDebt: (debt: Debt) => void
  // ... etc
}
```

### 2. CSP Slider Constraint System

The 4 buckets must total 100%. The approach:
- Each slider is independently draggable within its range
- A "remaining" indicator shows how much is unallocated
- If moving a slider would exceed 100%, it stops at the max possible
- A "balance" button auto-distributes remaining percentage proportionally
- Real dollar amounts update live based on total monthly income

### 3. Debt Payoff Calculation Engine (Server-Side)

Three strategies, all computed server-side for accuracy:

- **Avalanche**: Pay minimums on all, extra goes to highest APR first
- **Snowball**: Pay minimums on all, extra goes to lowest balance first
- **Utilization-First**: Pay minimums on all, extra goes to highest utilization ratio first (balance/limit for revolving accounts; installment debts are deprioritized)

Each produces: month-by-month amortization schedule, total interest paid, payoff date, and utilization milestones for each revolving account.

### 4. Partner Mode Privacy Architecture

Row Level Security (RLS) policies enforce privacy at the database level:

- Users can only read their own rows by default
- Partnership creates a bridge — shared data (joint plan, rules, vision) is readable by both partners
- Individual data (scripts, personal debts, income detail) requires the owning user's `privacySettings` to have the relevant flag set to `true` before the partner can access it
- The AI API routes must filter data based on privacy settings before including it in prompts — RLS alone isn't sufficient for AI context since the server has elevated access

### 5. AI Integration Pattern

All AI features use server-side API routes that:
1. Gather relevant user data (respecting privacy settings for partner contexts)
2. Construct a system prompt with the counselor persona
3. Send to Claude API with structured data in the user message
4. Return the response to the client

System prompts vary by feature but share the core philosophy: warmth of Tiffany Aliche, directness of Ramit Sethi, anti-shame of Dana Miranda, behavioral wisdom of Morgan Housel.

### 6. Credit Health as Derived Data

No separate credit data entry — everything is derived from the debt inventory:
- Utilization = sum(revolving balances) / sum(revolving limits)
- Per-card utilization for the Utilization-First strategy
- Payment automation coverage = automated items / total debt accounts
- Debt mix = count of distinct DebtTypes
- Contextual nudges are rule-based (not AI) for speed and predictability

### 7. Design System

```
Colors:
  --bg-primary:    #FAF7F2  (warm cream)
  --bg-secondary:  #F3EDE4  (warm linen)
  --text-primary:  #3D2B1F  (deep warm brown)
  --text-secondary:#6B5744  (medium brown)
  --accent-gold:   #C4A265  (muted gold)
  --cat-green:     #4A6741  (forest green)
  --cat-blue:      #5B7B8A  (slate blue)
  --cat-terra:     #B56B4A  (terracotta)
  --cat-plum:      #7B5E7B  (soft plum)
  --success:       #5A8A5A  (soft green)
  --warning:       #C4944A  (warm amber)
  --error:         #B55A5A  (soft red)

Typography:
  Headings: Playfair Display (serif, warm editorial)
  Body: DM Sans (clean, friendly sans)

Spacing:  8px base unit
Radius:   12px cards, 8px buttons, full for pills
Shadows:  Warm-toned, subtle (0 2px 8px rgba(61,43,31,0.08))
```

### 8. Responsive Strategy

Mobile-first with breakpoints:
- `sm` (640px): Stack → side-by-side for small groups
- `md` (768px): Dashboard grid shifts from 1-col to 2-col
- `lg` (1024px): Full desktop layout, sidebar navigation
- Flow pages are single-column up to `md`, content max-width 640px

### 9. Animation Philosophy

Framer Motion for:
- Step transitions (slide left/right with fade)
- Slider value changes (spring physics)
- Score ring filling animation
- Card entrance stagger
- Celebration moments (confetti-style for milestones)

Keep animations under 300ms for interactions, 500ms for transitions. Respect `prefers-reduced-motion`.
