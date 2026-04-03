"use server";

export async function syncFlowData(data: {
  scripts: Record<number, string>;
  moneyType: string | null;
  debts: Array<{
    name: string;
    balance: number;
    apr: number;
    minimumPayment: number;
    debtType: string;
    creditLimit?: number;
  }>;
  incomeSources: Array<{
    name: string;
    monthlyAmount: number;
    isAfterTax: boolean;
  }>;
  spendingPlan: {
    fixedCostsPercent: number;
    savingsPercent: number;
    investmentsPercent: number;
    guiltFreePercent: number;
  } | null;
  moneyDials: Record<string, number>;
}) {
  // TODO: Wire to Supabase/Prisma when auth is connected
  // For now, return success to enable the flow
  try {
    // Will use: const supabase = await createClient()
    // const { data: { user } } = await supabase.auth.getUser()
    // Then create/update all related records via Prisma
    return { success: true };
  } catch (error) {
    return { success: false, error: "Sync failed" };
  }
}
