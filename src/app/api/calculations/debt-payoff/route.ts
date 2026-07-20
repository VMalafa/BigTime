import { NextResponse } from "next/server";
import {
  calculateAllStrategies,
  type DebtInput,
} from "@/lib/calculations/debt-payoff";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { debts, extraMonthlyPayment } = body as {
      debts: DebtInput[];
      extraMonthlyPayment: number;
    };

    if (!Array.isArray(debts) || typeof extraMonthlyPayment !== "number") {
      return NextResponse.json(
        { error: "Invalid input: expected { debts: DebtInput[], extraMonthlyPayment: number }" },
        { status: 400 },
      );
    }

    const results = calculateAllStrategies(debts, extraMonthlyPayment);
    return NextResponse.json(results);
  } catch (error) {
    // Diagnosable failures (#109): log with context before the generic 500.
    console.error("[calculations/debt-payoff] request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to calculate debt payoff strategies" },
      { status: 500 },
    );
  }
}
