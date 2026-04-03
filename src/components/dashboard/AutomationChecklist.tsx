"use client";

import { motion } from "framer-motion";

interface AutomationItem {
  title: string;
  description: string;
  isCompleted: boolean;
}

interface AutomationChecklistProps {
  items: AutomationItem[];
}

export function AutomationChecklist({ items }: AutomationChecklistProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <motion.div
          key={item.title}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.08, duration: 0.3 }}
          className="flex items-start gap-3 p-3 rounded-lg bg-bg-secondary/60"
        >
          <div
            className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors duration-200 ${
              item.isCompleted
                ? "bg-accent-gold border-accent-gold"
                : "border-text-secondary/30 bg-white"
            }`}
          >
            {item.isCompleted && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="text-white"
              >
                <path
                  d="M2.5 6L5 8.5L9.5 3.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-medium font-sans ${
                item.isCompleted
                  ? "text-text-secondary line-through"
                  : "text-text-primary"
              }`}
            >
              {item.title}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              {item.description}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
