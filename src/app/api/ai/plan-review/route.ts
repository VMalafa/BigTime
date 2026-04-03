import { NextResponse } from "next/server";
import { generateAIResponse } from "@/lib/ai/client";
import { PLAN_REVIEW_PROMPT } from "@/lib/ai/prompts";
import type { PlanReviewRequest } from "@/lib/ai/types";

export async function POST(request: Request) {
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
    return NextResponse.json(
      { content: "", error: "Failed to generate plan review" },
      { status: 500 }
    );
  }
}
