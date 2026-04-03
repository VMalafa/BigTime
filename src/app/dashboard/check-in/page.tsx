"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface CheckInForm {
  wentWell: string;
  feltHard: string;
  adjustNext: string;
  creditWins: string;
}

const initialForm: CheckInForm = {
  wentWell: "",
  feltHard: "",
  adjustNext: "",
  creditWins: "",
};

const questions: { key: keyof CheckInForm; label: string }[] = [
  {
    key: "wentWell",
    label: "What went well with your money this month?",
  },
  {
    key: "feltHard",
    label: "What felt hard or stressful?",
  },
  {
    key: "adjustNext",
    label: "What would you like to adjust for next month?",
  },
  {
    key: "creditWins",
    label: "Any credit wins? (payments made, utilization down, etc.)",
  },
];

export default function CheckInPage() {
  const [form, setForm] = useState<CheckInForm>(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (key: keyof CheckInForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setAiResponse(null);

    try {
      const res = await fetch("/api/ai/monthly-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error("Failed to get reflection. Please try again.");
      }

      const data = await res.json();
      setAiResponse(data.reflection ?? data.message ?? "Reflection complete.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const hasContent = Object.values(form).some((v) => v.trim().length > 0);

  return (
    <div>
      <motion.h1
        className="font-serif text-3xl text-text-primary mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Monthly Check-In
      </motion.h1>
      <p className="text-text-secondary font-sans text-sm mb-8 italic">
        &ldquo;Spend less than an hour on your money. Let&rsquo;s reflect on
        this month.&rdquo;
      </p>

      <div className="space-y-6">
        {questions.map(({ key, label }, index) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
          >
            <label className="block font-sans text-sm font-medium text-text-primary mb-2">
              {label}
            </label>
            <textarea
              value={form[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-bg-secondary bg-white px-4 py-3 text-sm font-sans text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-gold focus:border-accent-gold transition-colors resize-none"
              placeholder="Type your thoughts..."
            />
          </motion.div>
        ))}

        <div className="pt-2">
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            disabled={!hasContent || isLoading}
          >
            {isLoading ? "Reflecting..." : "Get Your Reflection"}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-8 flex items-center justify-center py-12"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
              <p className="text-text-secondary text-sm font-sans">
                Generating your reflection...
              </p>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-8"
          >
            <Card padding="md" className="border-error/30 bg-error/5">
              <p className="text-error text-sm font-sans">{error}</p>
            </Card>
          </motion.div>
        )}

        {aiResponse && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-8"
          >
            <Card padding="lg" className="bg-bg-secondary/30 border-accent-gold/20">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-gold/10 flex items-center justify-center mt-0.5">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="text-accent-gold"
                  >
                    <path
                      d="M8 2l1.854 3.854L14 7.5l-3 2.927.708 4.073L8 12.5 4.292 14.5 5 10.427 2 7.5l4.146-1.646L8 2z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-lg text-text-primary mb-2">
                    Your Monthly Reflection
                  </h3>
                  <p className="text-text-secondary text-sm font-sans leading-relaxed whitespace-pre-wrap">
                    {aiResponse}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
