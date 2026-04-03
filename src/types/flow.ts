import type { MoneyType, DebtEntry, IncomeEntry, SpendingPlanData, DialCategory } from "@/lib/store/flow-store";

export interface FlowStep {
  id: number;
  path: string;
  label: string;
  description: string;
}

export const FLOW_STEPS: FlowStep[] = [
  { id: 0, path: "/flow/scripts", label: "Money Scripts", description: "Discover your money beliefs" },
  { id: 1, path: "/flow/money-type", label: "Money Type", description: "Identify your money personality" },
  { id: 2, path: "/flow/debts", label: "Financial Picture", description: "Map your debts and income" },
  { id: 3, path: "/flow/spending-plan", label: "Spending Plan", description: "Create your Conscious Spending Plan" },
  { id: 4, path: "/flow/money-dials", label: "Money Dials", description: "Choose what matters most" },
  { id: 5, path: "/flow/summary", label: "Your Plan", description: "See your complete Rich Life plan" },
];

export interface FlowData {
  scripts: Record<number, string>;
  moneyType: MoneyType | null;
  debts: DebtEntry[];
  incomeSources: IncomeEntry[];
  spendingPlan: SpendingPlanData | null;
  moneyDials: Record<DialCategory, number>;
}
