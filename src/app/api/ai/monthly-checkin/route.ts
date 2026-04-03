import { NextResponse } from "next/server";
import { generateAIResponse } from "@/lib/ai/client";
import { MONTHLY_CHECKIN_PROMPT } from "@/lib/ai/prompts";
import type { MonthlyCheckInRequest } from "@/lib/ai/types";

export async function POST(request: Request) {
  try {
    const data: MonthlyCheckInRequest = await request.json();

    const userMessage = `Here is my monthly check-in:

What went well this month:
${data.wentWell}

What felt hard:
${data.feltHard}

What I want to adjust:
${data.toAdjust}
${data.creditWins ? `\nCredit wins this month:\n${data.creditWins}` : ""}
${data.moneyType ? `\nMy Money Type: ${data.moneyType}` : ""}`;

    const content = await generateAIResponse(
      MONTHLY_CHECKIN_PROMPT,
      userMessage
    );
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { content: "", error: "Failed to generate check-in response" },
      { status: 500 }
    );
  }
}
