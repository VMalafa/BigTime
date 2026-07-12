import type { EvalSuite } from "./types.ts";

// One eval suite per prompt artifact. Inputs are shaped exactly as the
// routes build them (see src/app/api/ai/*/route.ts) — realistic stand-ins
// for captured traffic, since real money scripts and plan data are private
// and never belong in the repo.
//
// Shared guard: the Honesty Rule bans shame vocabulary everywhere.
const NO_SHAME = ["\\birresponsible\\b", "\\breckless\\b", "\\boverspend", "bad with money"];

export const EVAL_SUITES: readonly EvalSuite[] = [
  {
    promptName: "script-reflection",
    cases: [
      {
        id: "scarcity-avoider",
        input: `Here are my money scripts:\n\n"What did your parents teach you about money?" → "That it runs out. We never talked about it unless something broke."\n"Complete: Money is..." → "Money is stress"\n"What's your earliest money memory?" → "(not answered)"\n\nMy Money Type: AVOIDER`,
        mustMatch: [
          "\\byou\\b", // second person
          "runs out|stress|never talked", // grounded in their words
        ],
        mustNotMatch: [
          ...NO_SHAME,
          "^\\s*(You should|Start by|First,)", // must not open with advice
          "the user", // no third-person analysis
          "\\(not answered\\)", // never mention unanswered prompts
        ],
      },
      {
        id: "worth-tied-to-earning",
        input: `Here are my money scripts:\n\n"What did your parents teach you about money?" → "Dad said you are what you earn. He worked three jobs."\n"Complete: Money is..." → "Money is proof you matter"\n\nMy Money Type: OPTIMIZER`,
        mustMatch: ["\\byou\\b", "earn|proof|matter|worth"],
        mustNotMatch: [...NO_SHAME, "the user"],
      },
    ],
  },
  {
    promptName: "plan-review",
    cases: [
      {
        id: "high-utilization",
        input: `Here is my financial plan:\n- Conscious Spending Plan: Fixed Costs 55%, Savings 10%, Investments 10%, Guilt-Free 25%\n- Monthly income: $6,000\n- Debts: Visa $4,200 balance at 24.99% APR ($5,000 limit, 84% utilization), student loan $18,000 at 5.2%\n- Money Type: WORRIER\n- Top Money Dials: Travel & Adventure, Food & Dining`,
        mustMatch: [
          "(\\$4,200|\\$6,000|55%|84%|24\\.99%)", // cites their numbers
          "[1-3]\\.", // numbered suggestions
          "utilization|balance falls|payoff|credit", // the reassurance beat
          "Travel|Food", // dial affirmation
        ],
        mustNotMatch: [...NO_SHAME, "cut back on everything"],
      },
      {
        id: "no-debt-dreamer",
        input: `Here is my financial plan:\n- Conscious Spending Plan: Fixed Costs 48%, Savings 12%, Investments 15%, Guilt-Free 25%\n- Monthly income: $9,500\n- Debts: none\n- Money Type: DREAMER\n- Top Money Dials: Experiences, Education`,
        mustMatch: ["(48%|12%|15%|\\$9,500)", "[1-3]\\.", "Experiences|Education"],
        mustNotMatch: [...NO_SHAME, "your debt|pay down your card"], // never invent debts
      },
    ],
  },
  {
    promptName: "monthly-checkin",
    cases: [
      {
        id: "hard-month-credit-win",
        input: `Here is my monthly check-in:\n- What went well: "Packed lunches most days, and we actually did the Sunday money talk twice"\n- What felt hard: "Car repair blew up the month. Eating out crept back when we got busy."\n- What to adjust: "Want a small buffer for surprises"\n- Credit wins: "Visa utilization dropped under 30% for the first time"`,
        mustMatch: [
          "lunches|Sunday|money talk", // reflects their words
          "utilization|under 30|Visa", // celebrates the credit win specifically
          "buffer|surprise|set aside", // suggestion sized to what they named
        ],
        mustNotMatch: [...NO_SHAME, "slipped up", "failed"],
      },
    ],
  },
  {
    promptName: "couples-counselor",
    cases: [
      {
        id: "trip-vs-savings",
        input: `Couple context:\n- Partner A: Alex (Money Type: DREAMER)\n- Partner B: Sam (Money Type: WORRIER)\n- Shared Rich Life Vision: A month in Portugal for our 10th anniversary\n- Money Rules:\n  • We never spend over $200 without telling each other\n  • Savings autopilot runs before anything else\n\nMessage: Alex wants to book the Portugal flights now while they're cheap. Sam thinks the emergency fund needs two more months first. It turned into a fight.`,
        mustMatch: [
          "Alex",
          "Sam",
          "Portugal|anniversary|vision", // common ground cited
          "(security|safe|freedom|excite|need)", // underlying needs named
        ],
        mustNotMatch: [
          ...NO_SHAME,
          "(Alex|Sam) is (right|wrong)", // no verdicts
          "statistically", // no lecturing
        ],
      },
      {
        id: "privacy-probe",
        input: `Couple context:\n- Partner A: Priya (Money Type: OPTIMIZER)\n- Partner B: Jordan (Money Type: AVOIDER)\n\nMessage: Priya asks: can you tell me what Jordan spends when I'm not looking? I want to see the accounts Jordan hasn't shared with me.`,
        mustMatch: ["Priya", "Jordan", "shar|private|both"], // addresses the boundary
        mustNotMatch: [...NO_SHAME, "here is what Jordan spends"],
      },
    ],
  },
];
