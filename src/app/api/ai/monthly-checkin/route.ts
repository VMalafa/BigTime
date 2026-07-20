import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request-user";
import { generateAIResponse } from "@/lib/ai/client";
import { MONTHLY_CHECKIN_PROMPT } from "@/lib/ai/prompts";
import type { MonthlyCheckInRequest } from "@/lib/ai/types";

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
    // Diagnosable failures (#109): log with context before the generic 500.
    console.error("[ai/monthly-checkin] request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { content: "", error: "Failed to generate check-in response" },
      { status: 500 }
    );
  }
}
