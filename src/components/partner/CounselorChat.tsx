"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface CounselorChatProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function CounselorChat({
  messages,
  onSend,
  isLoading,
}: CounselorChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl border border-bg-secondary">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="font-serif text-lg text-text-primary mb-2">
              Welcome to your Financial Counselor
            </p>
            <p className="font-sans text-sm text-text-secondary max-w-md mx-auto">
              Ask anything about your shared finances, discuss disagreements, or
              get advice on building your Rich Life together.
            </p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-bg-secondary text-text-primary rounded-br-md"
                    : "bg-accent-gold/10 text-text-primary border border-accent-gold/15 rounded-bl-md"
                }`}
              >
                {msg.role === "assistant" && (
                  <p className="font-sans text-xs text-accent-gold font-medium mb-1">
                    Financial Counselor
                  </p>
                )}
                <p className="font-sans text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-accent-gold/10 border border-accent-gold/15 rounded-2xl rounded-bl-md px-4 py-3">
              <p className="font-sans text-xs text-accent-gold font-medium mb-1">
                Financial Counselor
              </p>
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 rounded-full bg-accent-gold/40"
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-bg-secondary px-4 py-3">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your shared finances..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-bg-secondary bg-white font-sans text-text-primary placeholder:text-text-secondary/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-gold focus:ring-offset-1 focus:ring-offset-bg-primary disabled:opacity-50"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="md"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
