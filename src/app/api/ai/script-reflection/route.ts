import { NextResponse } from "next/server";
import { generateAIResponse } from "@/lib/ai/client";
import { SCRIPT_REFLECTION_PROMPT } from "@/lib/ai/prompts";
import { MONEY_SCRIPTS } from "@/lib/constants/money-scripts";

export async function POST(request: Request) {
  try {
    const { scripts, moneyType } = await request.json();

    const scriptEntries = MONEY_SCRIPTS.map((s) => {
      const response = scripts[s.id] || "(not answered)";
      return `"${s.prompt}" → "${response}"`;
    }).join("\n");

    const userMessage = `Here are my money scripts:\n\n${scriptEntries}\n\nMy Money Type: ${moneyType}`;

    const content = await generateAIResponse(
      SCRIPT_REFLECTION_PROMPT,
      userMessage
    );
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { content: "", error: "Failed to generate reflection" },
      { status: 500 }
    );
  }
}
