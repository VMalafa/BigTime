export interface DashboardData {
  spendingPlan: {
    fixedCosts: { percent: number; amount: number };
    savings: { percent: number; amount: number };
    investments: { percent: number; amount: number };
    guiltFree: { percent: number; amount: number };
  };
  debtSummary: {
    totalDebt: number;
    totalMinPayments: number;
    debtCount: number;
    projectedPayoffDate: string;
  };
  creditHealth: {
    utilization: number;
    category: "optimal" | "good" | "acceptable" | "high";
    automationCoverage: number;
    paymentStreak: number;
  };
  lastCheckIn: string | null;
}

export interface AutomationItemData {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  category: "BILL_PAY" | "SAVINGS_TRANSFER" | "INVESTMENT_TRANSFER" | "CREDIT_PROTECTION" | "CREDIT_MONITORING";
}
