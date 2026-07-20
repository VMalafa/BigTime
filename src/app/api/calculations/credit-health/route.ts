import { NextResponse } from "next/server";
import {
  calculateCreditHealth,
  type DebtInput,
} from "@/lib/calculations/credit-health";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { debts } = body as { debts: DebtInput[] };

    if (!Array.isArray(debts)) {
      return NextResponse.json(
        { error: "Invalid input: expected { debts: DebtInput[] }" },
        { status: 400 },
      );
    }

    const result = calculateCreditHealth(debts);
    return NextResponse.json(result);
  } catch (error) {
    // Diagnosable failures (#109): log with context before the generic 500.
    console.error("[calculations/credit-health] request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to calculate credit health" },
      { status: 500 },
    );
  }
}
