"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CounselorChat } from "@/components/partner/CounselorChat";
import { usePartnerStore } from "@/lib/store/partner-store";
import { useReflection } from "@/lib/hooks/useReflection";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function CounselorPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { partnerMoneyType } = usePartnerStore();
  const { moneyType } = useReflection();

  const handleSend = async (content: string) => {
    const userMessage: ChatMessage = { role: "user", content };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/couples-counselor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          partnerAMoneyType: moneyType || "OPTIMIZER",
          partnerBMoneyType: partnerMoneyType || "DREAMER",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message || data.content },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I'm here to help you both navigate your finances together. Could you tell me more about what you'd like to discuss? Common topics include spending differences, saving goals, debt strategies, and building your shared Rich Life vision.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm here to help you both navigate your finances together. Could you tell me more about what you'd like to discuss? Common topics include spending differences, saving goals, debt strategies, and building your shared Rich Life vision.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="border-b border-bg-secondary px-4 py-5 bg-bg-primary/95 backdrop-blur-sm"
      >
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-serif text-2xl text-text-primary mb-1">
            Your Financial Counselor
          </h1>
          <p className="font-sans text-sm text-text-secondary">
            A safe space to discuss money as a couple. Ask anything.
          </p>
        </div>
      </motion.div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <CounselorChat
          messages={messages}
          onSend={handleSend}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
