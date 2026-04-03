import { NextResponse } from "next/server";
import {
  calculateWholenessScore,
  type WholenessInput,
} from "@/lib/calculations/wholeness-score";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WholenessInput;

    if (typeof body.hasSpendingPlan !== "boolean") {
      return NextResponse.json(
        { error: "Invalid input: expected WholenessInput" },
        { status: 400 },
      );
    }

    const result = calculateWholenessScore(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to calculate wholeness score" },
      { status: 500 },
    );
  }
}
