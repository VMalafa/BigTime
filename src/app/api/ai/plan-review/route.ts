import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request-user";
import { generateAIResponse } from "@/lib/ai/client";
import { PLAN_REVIEW_PROMPT } from "@/lib/ai/prompts";
import type { PlanReviewRequest } from "@/lib/ai/types";

export async function POST(request: Request) {
  // Authenticated households only (#109): these routes spend the
  // household's Anthropic budget — anonymous visitors get a 401, never
  // a completion.
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json(
      { content: "", error: "Not signed in." },
      { status: 401 }
    );
  }

  try {
    const data: PlanReviewRequest = await request.json();

    const debtSummary = data.debts
      .map(
        (d) =>
          `- ${d.name}: $${d.balance.toLocaleString()} at ${d.apr}% APR (${d.debtType})${d.creditLimit ? `, limit $${d.creditLimit.toLocaleString()}` : ""}`
      )
      .join("\n");

    const dialEntries = Object.entries(data.moneyDials)
      .sort(([, a], [, b]) => b - a)
      .map(([name, level]) => `- ${name}: ${level}/10`)
      .join("\n");

    const creditSection = data.creditHealth
      ? `\nCredit Health:\n- Aggregate utilization: ${data.creditHealth.aggregateUtilization}%\n- Category: ${data.creditHealth.utilizationCategory}`
      : "";

    const userMessage = `Here is my financial plan:

Money Type: ${data.moneyType}

Monthly Income: $${data.totalIncome.toLocaleString()}

Conscious Spending Plan:
- Fixed Costs: ${data.spendingPlan.fixedCostsPercent}%
- Savings: ${data.spendingPlan.savingsPercent}%
- Investments: ${data.spendingPlan.investmentsPercent}%
- Guilt-Free Spending: ${data.spendingPlan.guiltFreePercent}%

Debts:
${debtSummary || "None"}

Money Dials (priorities):
${dialEntries || "Not set"}
${creditSection}`;

    const content = await generateAIResponse(PLAN_REVIEW_PROMPT, userMessage);
    return NextResponse.json({ content });
  } catch (error) {
    // Diagnosable failures (#109): log with context before the generic 500.
    console.error("[ai/plan-review] request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { content: "", error: "Failed to generate plan review" },
      { status: 500 }
    );
  }
}
