export interface DebtInput {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  debtType: string;
  creditLimit?: number;
}

export interface PayoffResult {
  strategy: "avalanche" | "snowball" | "utilization";
  totalInterestPaid: number;
  totalMonths: number;
  payoffDate: string;
  monthlySchedule: Array<{
    month: number;
    totalBalance: number;
    totalPayment: number;
    totalInterest: number;
  }>;
  perDebtSchedule: Array<{
    debtId: string;
    debtName: string;
    payoffMonth: number;
    totalInterestPaid: number;
  }>;
  utilizationMilestones: Array<{
    debtId: string;
    debtName: string;
    threshold: number;
    month: number;
  }>;
}

function isRevolvingType(debtType: string): boolean {
  return debtType === "CREDIT_CARD" || debtType === "OTHER_REVOLVING";
}

interface DebtState {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  debtType: string;
  creditLimit?: number;
  totalInterestPaid: number;
  paidOffMonth: number | null;
}

function cloneDebts(debts: DebtInput[]): DebtState[] {
  return debts.map((d) => ({
    ...d,
    balance: d.balance,
    totalInterestPaid: 0,
    paidOffMonth: null,
  }));
}

function simulatePayoff(
  debts: DebtInput[],
  extraPayment: number,
  strategy: "avalanche" | "snowball" | "utilization",
  prioritize: (active: DebtState[]) => DebtState[],
): PayoffResult {
  const MAX_MONTHS = 360;
  const states = cloneDebts(debts);
  const monthlySchedule: PayoffResult["monthlySchedule"] = [];
  const utilizationMilestones: PayoffResult["utilizationMilestones"] = [];

  // Track which utilization thresholds have been recorded per debt
  const milestonesRecorded: Record<string, Set<number>> = {};
  for (const d of states) {
    milestonesRecorded[d.id] = new Set();
  }

  let month = 0;
  let totalInterest = 0;

  while (month < MAX_MONTHS) {
    const active = states.filter((d) => d.balance > 0);
    if (active.length === 0) break;

    month++;

    let monthTotalPayment = 0;
    let monthTotalInterest = 0;

    // 1. Charge interest on all active debts
    for (const debt of active) {
      const monthlyRate = debt.apr / 12 / 100;
      const interest = debt.balance * monthlyRate;
      debt.balance += interest;
      debt.totalInterestPaid += interest;
      monthTotalInterest += interest;
    }

    totalInterest += monthTotalInterest;

    // 2. Pay minimums on all active debts
    let freedUpMinimums = 0;
    for (const debt of active) {
      const payment = Math.min(debt.minimumPayment, debt.balance);
      debt.balance -= payment;
      monthTotalPayment += payment;

      if (debt.balance <= 0.005) {
        debt.balance = 0;
        if (debt.paidOffMonth === null) {
          debt.paidOffMonth = month;
          freedUpMinimums += debt.minimumPayment - payment;
        }
      }
    }

    // 3. Apply extra payment + freed minimums from debts paid off by minimums
    let remaining = extraPayment + freedUpMinimums;

    // Also add minimums from previously paid-off debts (snowball effect)
    for (const debt of states) {
      if (debt.paidOffMonth !== null && debt.paidOffMonth < month) {
        remaining += debt.minimumPayment;
      }
    }

    // Get priority order for extra payments
    const stillActive = states.filter((d) => d.balance > 0);
    const prioritized = prioritize(stillActive);

    for (const debt of prioritized) {
      if (remaining <= 0) break;
      const payment = Math.min(remaining, debt.balance);
      debt.balance -= payment;
      remaining -= payment;
      monthTotalPayment += payment;

      if (debt.balance <= 0.005) {
        debt.balance = 0;
        if (debt.paidOffMonth === null) {
          debt.paidOffMonth = month;
        }
      }
    }

    // 4. Track utilization milestones for revolving debts
    for (const debt of states) {
      if (!isRevolvingType(debt.debtType) || !debt.creditLimit) continue;
      const util = (debt.balance / debt.creditLimit) * 100;
      for (const threshold of [30, 10, 7]) {
        if (util < threshold && !milestonesRecorded[debt.id].has(threshold)) {
          milestonesRecorded[debt.id].add(threshold);
          utilizationMilestones.push({
            debtId: debt.id,
            debtName: debt.name,
            threshold,
            month,
          });
        }
      }
    }

    const totalBalance = states.reduce((sum, d) => sum + d.balance, 0);
    monthlySchedule.push({
      month,
      totalBalance: Math.round(totalBalance * 100) / 100,
      totalPayment: Math.round(monthTotalPayment * 100) / 100,
      totalInterest: Math.round(monthTotalInterest * 100) / 100,
    });
  }

  const now = new Date();
  const payoffDate = new Date(now.getFullYear(), now.getMonth() + month, 1);
  const payoffDateStr = payoffDate.toISOString().slice(0, 10);

  const perDebtSchedule = states.map((d) => ({
    debtId: d.id,
    debtName: d.name,
    payoffMonth: d.paidOffMonth ?? MAX_MONTHS,
    totalInterestPaid: Math.round(d.totalInterestPaid * 100) / 100,
  }));

  return {
    strategy,
    totalInterestPaid: Math.round(totalInterest * 100) / 100,
    totalMonths: month,
    payoffDate: payoffDateStr,
    monthlySchedule,
    perDebtSchedule,
    utilizationMilestones,
  };
}

function calculateAvalanche(
  debts: DebtInput[],
  extraPayment: number,
): PayoffResult {
  return simulatePayoff(debts, extraPayment, "avalanche", (active) =>
    [...active].sort((a, b) => b.apr - a.apr),
  );
}

function calculateSnowball(
  debts: DebtInput[],
  extraPayment: number,
): PayoffResult {
  return simulatePayoff(debts, extraPayment, "snowball", (active) =>
    [...active].sort((a, b) => a.balance - b.balance),
  );
}

function calculateUtilizationFirst(
  debts: DebtInput[],
  extraPayment: number,
): PayoffResult {
  return simulatePayoff(debts, extraPayment, "utilization", (active) => {
    const revolving = active
      .filter(
        (d) => isRevolvingType(d.debtType) && d.creditLimit && d.balance > 0,
      )
      .sort((a, b) => {
        const utilA = a.balance / (a.creditLimit ?? 1);
        const utilB = b.balance / (b.creditLimit ?? 1);
        return utilB - utilA;
      });

    // If there are still revolving debts with balance, prioritize them
    if (revolving.length > 0) {
      return revolving;
    }

    // All revolving debts paid off; tackle installment by balance ascending
    const installment = active
      .filter((d) => !isRevolvingType(d.debtType) && d.balance > 0)
      .sort((a, b) => a.balance - b.balance);

    return installment;
  });
}

export function calculateAllStrategies(
  debts: DebtInput[],
  extraPayment: number,
): {
  avalanche: PayoffResult;
  snowball: PayoffResult;
  utilization: PayoffResult;
} {
  return {
    avalanche: calculateAvalanche(debts, extraPayment),
    snowball: calculateSnowball(debts, extraPayment),
    utilization: calculateUtilizationFirst(debts, extraPayment),
  };
}
