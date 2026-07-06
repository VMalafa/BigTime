import type {
  DebtEntry,
  IncomeEntry,
  BonusEntry,
  SpendingPlanData,
} from "@/lib/store/flow-store";
import type { AutomationCategoryValue } from "@/app/actions/automation";

export interface SuggestedAutomation {
  key: string;
  title: string;
  description: string;
  category: AutomationCategoryValue;
  /** Why this was suggested — shown as a small rationale */
  rationale: string;
}

interface Input {
  debts: DebtEntry[];
  incomeSources: IncomeEntry[];
  bonusItems: BonusEntry[];
  spendingPlan: SpendingPlanData | null;
}

/**
 * Derive a personalized list of automation next steps from the user's plan.
 * The returned set is stable by `key`, so the UI can dedupe against items the
 * user has already added to their saved automation list.
 */
export function suggestAutomations(input: Input): SuggestedAutomation[] {
  const { debts, incomeSources, bonusItems, spendingPlan } = input;
  const suggestions: SuggestedAutomation[] = [];

  // 1. Autopay on every debt account (protect payment history)
  if (debts.length > 0) {
    suggestions.push({
      key: "autopay-debts",
      title: `Set up autopay on all ${debts.length} debt accounts`,
      description:
        "Enroll at least the minimum payment on every account. You can always pay more manually, but this guarantees your payment history stays clean.",
      category: "BILL_PAY",
      rationale: `${debts.length} debt${debts.length !== 1 ? "s" : ""} tracked`,
    });
  }

  // 2. Automated savings transfer — only meaningful if there's income + a savings %
  const savingsPct = spendingPlan?.savingsPercent ?? 0;
  if (incomeSources.length > 0 && savingsPct > 0) {
    suggestions.push({
      key: "auto-savings",
      title: `Automate your ${savingsPct}% savings transfer`,
      description:
        "Set up a recurring transfer from checking to a high-yield savings account for the day after each payday. This is the single most effective way to build an emergency fund.",
      category: "SAVINGS_TRANSFER",
      rationale: `${savingsPct}% of income allocated to savings`,
    });
  }

  // 3. Automated investment transfer
  const investPct = spendingPlan?.investmentsPercent ?? 0;
  if (incomeSources.length > 0 && investPct > 0) {
    suggestions.push({
      key: "auto-investments",
      title: `Automate your ${investPct}% investment contribution`,
      description:
        "Set up a recurring contribution to your 401(k), Roth IRA, or brokerage. Start with your employer match — it's a 100% instant return.",
      category: "INVESTMENT_TRANSFER",
      rationale: `${investPct}% of income allocated to investments`,
    });
  }

  // 4. Bonus split plan — for users who track bonuses, suggest automating
  //    the split (savings + investing + debt payoff)
  if (bonusItems.length > 0) {
    suggestions.push({
      key: "bonus-split-plan",
      title: "Define a bonus allocation rule (50/30/20 split)",
      description:
        "Before your next bonus lands, pre-commit how it splits: 50% to savings/investments, 30% to debt paydown, 20% to guilt-free spending. Decide once, automate forever.",
      category: "SAVINGS_TRANSFER",
      rationale: `${bonusItems.length} bonus${
        bonusItems.length !== 1 ? "es" : ""
      } tracked`,
    });
  }

  // 5. Credit monitoring enrollment
  suggestions.push({
    key: "credit-monitoring",
    title: "Enroll in credit monitoring",
    description:
      "Sign up for free score tracking (Credit Karma, your bank app, or Experian). Set alerts for new accounts and score changes.",
    category: "CREDIT_MONITORING",
    rationale: "Catch errors and fraud early",
  });

  // 6. Credit freeze
  suggestions.push({
    key: "credit-freeze",
    title: "Freeze credit at all three bureaus",
    description:
      "Freezes are free at Equifax, Experian, and TransUnion. Prevents new accounts from being opened in your name with zero score impact.",
    category: "CREDIT_PROTECTION",
    rationale: "30-minute one-time setup",
  });

  // 7. Bill pay consolidation — only if fixed cost line items exist
  const hasFixedCosts =
    (spendingPlan?.fixedCostLineItems?.length ?? 0) > 0;
  if (hasFixedCosts) {
    suggestions.push({
      key: "bill-pay-consolidate",
      title: "Route every fixed bill through autopay",
      description:
        "Rent/mortgage, utilities, insurance, subscriptions — put them all on autopay from a single checking account or rewards card. You'll spend zero mental energy on bills.",
      category: "BILL_PAY",
      rationale: `${
        spendingPlan?.fixedCostLineItems?.length ?? 0
      } fixed cost line items`,
    });
  }

  return suggestions;
}
