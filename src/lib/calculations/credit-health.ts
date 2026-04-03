import { CREDIT_TIPS } from "@/lib/constants/credit-tips";

export interface DebtInput {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  debtType: string;
  creditLimit?: number;
}

export interface CreditHealthResult {
  aggregateUtilization: number;
  utilizationCategory: "optimal" | "good" | "acceptable" | "high";
  perCardUtilization: Array<{
    debtId: string;
    name: string;
    balance: number;
    limit: number;
    utilization: number;
    category: "optimal" | "good" | "acceptable" | "high";
  }>;
  automationCoverage: number;
  debtMix: { revolving: number; installment: number };
  nudges: string[];
}

function isRevolvingType(debtType: string): boolean {
  return debtType === "CREDIT_CARD" || debtType === "OTHER_REVOLVING";
}

function getUtilizationCategory(
  utilization: number,
): "optimal" | "good" | "acceptable" | "high" {
  if (utilization < 7) return "optimal";
  if (utilization < 10) return "good";
  if (utilization < 30) return "acceptable";
  return "high";
}

export function calculateCreditHealth(
  debts: DebtInput[],
  automatedCount?: number,
): CreditHealthResult {
  const revolvingDebts = debts.filter(
    (d) => isRevolvingType(d.debtType) && d.creditLimit != null,
  );
  const installmentDebts = debts.filter((d) => !isRevolvingType(d.debtType));

  // Aggregate utilization
  const totalRevolvingBalance = revolvingDebts.reduce(
    (sum, d) => sum + d.balance,
    0,
  );
  const totalRevolvingLimit = revolvingDebts.reduce(
    (sum, d) => sum + (d.creditLimit ?? 0),
    0,
  );
  const aggregateUtilization =
    totalRevolvingLimit > 0
      ? (totalRevolvingBalance / totalRevolvingLimit) * 100
      : 0;

  const utilizationCategory = getUtilizationCategory(aggregateUtilization);

  // Per-card utilization
  const perCardUtilization = revolvingDebts.map((d) => {
    const limit = d.creditLimit ?? 0;
    const utilization = limit > 0 ? (d.balance / limit) * 100 : 0;
    return {
      debtId: d.id,
      name: d.name,
      balance: d.balance,
      limit,
      utilization: Math.round(utilization * 100) / 100,
      category: getUtilizationCategory(utilization),
    };
  });

  // Automation coverage placeholder
  const automationCoverage = automatedCount ?? 0;

  // Debt mix
  const debtMix = {
    revolving: revolvingDebts.length,
    installment: installmentDebts.length,
  };

  // Generate nudges based on current state
  const nudges: string[] = [];

  if (revolvingDebts.length === 0) {
    const tip = CREDIT_TIPS.find((t) => t.condition === "no_revolving");
    if (tip) nudges.push(tip.message);
  } else {
    if (utilizationCategory === "high") {
      const tip = CREDIT_TIPS.find((t) => t.condition === "high_utilization");
      if (tip) nudges.push(tip.message);
    } else if (
      utilizationCategory === "acceptable" ||
      utilizationCategory === "good"
    ) {
      const tip = CREDIT_TIPS.find(
        (t) => t.condition === "moderate_utilization",
      );
      if (tip) nudges.push(tip.message);
    }
  }

  if (automationCoverage === 0 && debts.length > 0) {
    const tip = CREDIT_TIPS.find((t) => t.condition === "low_automation");
    if (tip) nudges.push(tip.message);
  }

  // Add a general tip
  const generalTips = CREDIT_TIPS.filter((t) => t.condition === "general");
  if (generalTips.length > 0) {
    nudges.push(generalTips[0].message);
  }

  return {
    aggregateUtilization: Math.round(aggregateUtilization * 100) / 100,
    utilizationCategory,
    perCardUtilization,
    automationCoverage,
    debtMix,
    nudges,
  };
}
