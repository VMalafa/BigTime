import type { DebtInput } from "@/lib/calculations/credit-health";

export type ActionPriority = "high" | "medium" | "low";

export type ActionCategory =
  | "PAYMENT_HISTORY"
  | "UTILIZATION"
  | "CREDIT_MIX"
  | "ACCOUNT_AGE"
  | "MONITORING"
  | "FRAUD_PROTECTION";

export interface CreditAction {
  id: string;
  title: string;
  description: string;
  priority: ActionPriority;
  category: ActionCategory;
  /** Numeric impact label shown in the UI, e.g. "+20-40 pts" */
  estimatedImpact: string;
  /** Est. time horizon to see movement */
  timeHorizon: string;
}

export interface CreditMilestone {
  utilization: number;
  label: string;
  description: string;
  reached: boolean;
}

export interface CreditStrategyResult {
  actions: CreditAction[];
  milestones: CreditMilestone[];
  primaryFocus: string;
  summary: string;
}

function isRevolving(debtType: string): boolean {
  return debtType === "CREDIT_CARD" || debtType === "OTHER_REVOLVING";
}

/**
 * Given the user's current debts, generate a prioritized action plan for
 * improving their credit position. The strategy follows the FICO factor
 * weighting order:
 *   1. Payment history (35%) → autopay
 *   2. Amounts owed / utilization (30%) → paydown + limit increases
 *   3. Length of history (15%) → don't close oldest accounts
 *   4. Credit mix (10%)
 *   5. New credit / inquiries (10%)
 */
export function buildCreditStrategy(
  debts: DebtInput[],
  opts: {
    autopayAllAccounts?: boolean;
    monitoringEnrolled?: boolean;
    frozenBureaus?: boolean;
    targetUtilization?: number;
  } = {}
): CreditStrategyResult {
  const target = opts.targetUtilization ?? 10;
  const revolving = debts.filter(
    (d) => isRevolving(d.debtType) && d.creditLimit != null
  );
  const totalBalance = revolving.reduce((s, d) => s + d.balance, 0);
  const totalLimit = revolving.reduce((s, d) => s + (d.creditLimit ?? 0), 0);
  const utilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

  const highUtilCards = revolving.filter((d) => {
    const limit = d.creditLimit ?? 0;
    return limit > 0 && d.balance / limit > 0.3;
  });

  // Target balance to hit `target`% utilization
  const targetBalance = (totalLimit * target) / 100;
  const paydownNeeded = Math.max(0, totalBalance - targetBalance);

  const actions: CreditAction[] = [];

  // 1. PAYMENT HISTORY — the single highest-impact lever
  if (!opts.autopayAllAccounts && debts.length > 0) {
    actions.push({
      id: "autopay-all",
      title: "Set up autopay on every account (minimum payment)",
      description:
        "Payment history is 35% of your FICO score. One missed payment can drop a good score by 60–110 points. Set autopay for at least the minimum on every account — you can always pay more manually.",
      priority: "high",
      category: "PAYMENT_HISTORY",
      estimatedImpact: "Protects 35% of score",
      timeHorizon: "Immediate",
    });
  }

  // 2. UTILIZATION — pay down high-utilization cards first
  if (utilization > target && highUtilCards.length > 0) {
    actions.push({
      id: "paydown-high-util",
      title: `Pay down high-utilization cards to under ${target}%`,
      description: `${highUtilCards.length} card${
        highUtilCards.length !== 1 ? "s are" : " is"
      } above 30% utilization. Focus extra payments on these first — utilization is 30% of your score and updates within 30–60 days of a statement cut. You need ~$${Math.round(
        paydownNeeded
      ).toLocaleString()} in extra payments to hit the target.`,
      priority: "high",
      category: "UTILIZATION",
      estimatedImpact: "+20-60 pts",
      timeHorizon: "1-3 months",
    });
  } else if (utilization > target && utilization <= 30 && totalLimit > 0) {
    actions.push({
      id: "fine-tune-util",
      title: `Drop aggregate utilization below ${target}%`,
      description: `You're already under 30% — the next threshold is ${target}%. Scoring models reward keeping aggregate utilization in the single digits. ~$${Math.round(
        paydownNeeded
      ).toLocaleString()} in extra payments gets you there.`,
      priority: "medium",
      category: "UTILIZATION",
      estimatedImpact: "+10-25 pts",
      timeHorizon: "1-2 months",
    });
  }

  // Credit limit increase request — passive lever that lowers utilization
  if (utilization > 10 && revolving.length > 0) {
    actions.push({
      id: "request-cli",
      title: "Request credit limit increases (soft-pull only)",
      description:
        "On issuer sites, look for limit increase requests that use a soft inquiry. A higher limit lowers utilization without paying down any debt. Ask for 25–50% increases on cards you've had 6+ months.",
      priority: "medium",
      category: "UTILIZATION",
      estimatedImpact: "+5-15 pts",
      timeHorizon: "1 month",
    });
  }

  // 3. ACCOUNT AGE — keep oldest cards open
  if (revolving.length > 0) {
    actions.push({
      id: "keep-old-open",
      title: "Keep your oldest cards open and active",
      description:
        "Length of credit history is 15% of your score. Put a small recurring charge (Netflix, Spotify, etc.) on your oldest card and autopay it — this keeps the account active without closing it.",
      priority: "low",
      category: "ACCOUNT_AGE",
      estimatedImpact: "Preserves 15%",
      timeHorizon: "Ongoing",
    });
  }

  // 4. MONITORING — free credit monitoring
  if (!opts.monitoringEnrolled) {
    actions.push({
      id: "enroll-monitoring",
      title: "Enroll in free credit monitoring",
      description:
        "Credit Karma, Experian, and most major banks offer free score tracking. Pull your free reports from AnnualCreditReport.com quarterly to catch errors — disputing inaccurate items can move a score 20+ points.",
      priority: "medium",
      category: "MONITORING",
      estimatedImpact: "+0-30 pts (if errors)",
      timeHorizon: "Immediate",
    });
  }

  // 5. FRAUD PROTECTION — credit freeze
  if (!opts.frozenBureaus) {
    actions.push({
      id: "freeze-bureaus",
      title: "Freeze your credit at all three bureaus",
      description:
        "A credit freeze is free, prevents new accounts from being opened in your name, and has zero impact on your score. Freeze at Equifax, Experian, and TransUnion — you can temporarily thaw it when you need to apply for credit.",
      priority: "medium",
      category: "FRAUD_PROTECTION",
      estimatedImpact: "Prevents fraud",
      timeHorizon: "30 minutes",
    });
  }

  // Derive milestones based on current utilization
  const milestones: CreditMilestone[] = [
    {
      utilization: 30,
      label: "Below 30%",
      description: "You've crossed out of the 'high' zone.",
      reached: utilization > 0 && utilization < 30,
    },
    {
      utilization: 10,
      label: "Below 10%",
      description: "Good territory — most scoring models reward single digits.",
      reached: utilization > 0 && utilization < 10,
    },
    {
      utilization: 7,
      label: "Below 7%",
      description: "Optimal zone. This is where the sharpest scores live.",
      reached: utilization > 0 && utilization < 7,
    },
    {
      utilization: 1,
      label: "1-2% (not $0)",
      description:
        "The sweet spot — show activity without carrying a balance. Pay the statement balance each month.",
      reached: false,
    },
  ];

  // Summary framing
  let primaryFocus = "";
  let summary = "";
  if (revolving.length === 0) {
    primaryFocus = "Payment history";
    summary =
      "You don't have revolving debt, so utilization isn't a factor. Focus 100% on on-time payments — that's 35% of your score.";
  } else if (utilization > 30) {
    primaryFocus = "Bring utilization below 30%";
    summary = `Aggregate utilization is ${utilization.toFixed(
      1
    )}%. Getting below 30% is your fastest visible win — typically within one statement cycle.`;
  } else if (utilization > 10) {
    primaryFocus = "Push utilization into single digits";
    summary = `Utilization is ${utilization.toFixed(
      1
    )}% — already healthy. Tightening to under ${target}% unlocks the next score tier.`;
  } else {
    primaryFocus = "Protect what you've built";
    summary = `Utilization is ${utilization.toFixed(
      1
    )}% — you're in good shape. Keep autopay active and monitor for errors.`;
  }

  return {
    actions,
    milestones,
    primaryFocus,
    summary,
  };
}
