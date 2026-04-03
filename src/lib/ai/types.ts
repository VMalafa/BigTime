export interface ScriptReflectionRequest {
  scripts: Record<number, string>;
  moneyType: string;
}

export interface PlanReviewRequest {
  moneyType: string;
  spendingPlan: {
    fixedCostsPercent: number;
    savingsPercent: number;
    investmentsPercent: number;
    guiltFreePercent: number;
  };
  totalIncome: number;
  debts: Array<{
    name: string;
    balance: number;
    apr: number;
    debtType: string;
    creditLimit?: number;
  }>;
  moneyDials: Record<string, number>;
  creditHealth?: {
    aggregateUtilization: number;
    utilizationCategory: string;
  };
}

export interface MonthlyCheckInRequest {
  wentWell: string;
  feltHard: string;
  toAdjust: string;
  creditWins?: string;
  moneyType?: string;
}

export interface CouplesRequest {
  message: string;
  partnerAName: string;
  partnerBName: string;
  partnerAMoneyType: string;
  partnerBMoneyType: string;
  sharedVision?: string;
  moneyRules?: string[];
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AIResponse {
  content: string;
  error?: string;
}
