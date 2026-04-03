"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";

interface PartnerPendingStateProps {
  message?: string;
}

export function PartnerPendingState({
  message = "Waiting for your partner...",
}: PartnerPendingStateProps) {
  return (
    <Card className="border-accent-gold/20">
      <div className="flex flex-col items-center py-8 gap-4">
        {/* Animated pulse circles */}
        <div className="relative flex items-center justify-center w-16 h-16">
          <motion.div
            className="absolute w-16 h-16 rounded-full bg-accent-gold/10"
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-10 h-10 rounded-full bg-accent-gold/20"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.1, 0.5] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.3,
            }}
          />
          <div className="w-6 h-6 rounded-full bg-accent-gold/30" />
        </div>

        <div className="text-center">
          <p className="font-serif text-lg text-text-primary mb-1">
            {message}
          </p>
          <div className="flex items-center justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-accent-gold"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            ))}
          </div>
        </div>

        <p className="font-sans text-sm text-text-secondary text-center max-w-xs">
          We will notify you when your partner completes their part. In the
          meantime, feel free to explore other sections.
        </p>
      </div>
    </Card>
  );
}
