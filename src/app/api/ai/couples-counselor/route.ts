import { NextResponse } from "next/server";
import { getAnthropicClient, generateAIResponse } from "@/lib/ai/client";
import { COUPLES_COUNSELOR_PROMPT } from "@/lib/ai/prompts";
import type { CouplesRequest } from "@/lib/ai/types";

export async function POST(request: Request) {
  try {
    const data: CouplesRequest = await request.json();

    const context = `Couple context:
- Partner A: ${data.partnerAName} (Money Type: ${data.partnerAMoneyType})
- Partner B: ${data.partnerBName} (Money Type: ${data.partnerBMoneyType})
${data.sharedVision ? `- Shared Rich Life Vision: ${data.sharedVision}` : ""}
${data.moneyRules?.length ? `- Money Rules:\n${data.moneyRules.map((r) => `  • ${r}`).join("\n")}` : ""}`;

    // Multi-turn conversation support
    if (data.conversationHistory && data.conversationHistory.length > 0) {
      const anthropic = getAnthropicClient();

      const messages = [
        ...data.conversationHistory.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user" as const, content: data.message },
      ];

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `${COUPLES_COUNSELOR_PROMPT}\n\n${context}`,
        messages,
      });

      const textBlock = response.content.find((b) => b.type === "text");
      return NextResponse.json({ content: textBlock?.text ?? "" });
    }

    // Single-turn request
    const userMessage = `${context}\n\nMessage: ${data.message}`;
    const content = await generateAIResponse(
      COUPLES_COUNSELOR_PROMPT,
      userMessage
    );
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { content: "", error: "Failed to generate counselor response" },
      { status: 500 }
    );
  }
}
