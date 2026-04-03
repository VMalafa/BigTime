export interface DebtPayoffResult {
  strategy: "avalanche" | "snowball" | "utilization";
  totalInterestPaid: number;
  totalMonths: number;
  payoffDate: string;
  monthlySchedule: MonthlySnapshot[];
  perDebtSchedule: PerDebtSchedule[];
  utilizationMilestones: UtilizationMilestone[];
}

export interface MonthlySnapshot {
  month: number;
  date: string;
  totalBalance: number;
  totalPayment: number;
  totalInterest: number;
  totalPrincipal: number;
  aggregateUtilization: number | null;
}

export interface PerDebtSchedule {
  debtId: string;
  debtName: string;
  payments: DebtPayment[];
  payoffMonth: number;
}

export interface DebtPayment {
  month: number;
  balance: number;
  payment: number;
  interest: number;
  principal: number;
  utilization?: number;
}

export interface UtilizationMilestone {
  debtId: string;
  debtName: string;
  threshold: number; // 30, 10, or 7
  month: number;
  date: string;
}

export interface CreditHealthSnapshot {
  aggregateUtilization: number;
  utilizationCategory: "optimal" | "good" | "acceptable" | "high";
  perCardUtilization: CardUtilization[];
  automationCoverage: number;
  debtMix: { revolving: number; installment: number };
  nudges: string[];
}

export interface CardUtilization {
  debtId: string;
  name: string;
  balance: number;
  limit: number;
  utilization: number;
  category: "optimal" | "good" | "acceptable" | "high";
}
