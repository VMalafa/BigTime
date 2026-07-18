import Anthropic from "@anthropic-ai/sdk";
import { anthropicModel } from "@/lib/ai/config";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return client;
}

export async function generateAIResponse(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 1024
): Promise<string> {
  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: anthropicModel(),
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}
