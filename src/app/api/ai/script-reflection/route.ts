import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request-user";
import { generateAIResponse } from "@/lib/ai/client";
import { SCRIPT_REFLECTION_PROMPT } from "@/lib/ai/prompts";
import { MONEY_SCRIPTS } from "@/lib/constants/money-scripts";

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
    // Diagnosable failures (#109): log with context before the generic 500.
    console.error("[ai/script-reflection] request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { content: "", error: "Failed to generate reflection" },
      { status: 500 }
    );
  }
}
