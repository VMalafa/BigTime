"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/Card";

interface MoneyTypeData {
  name: string;
  emoji: string;
  description: string;
  strengths: readonly string[];
  growthEdges: readonly string[];
}

interface MoneyTypeCardProps {
  type: string;
  data: MoneyTypeData;
  isSelected: boolean;
  onSelect: () => void;
}

export function MoneyTypeCard({
  type,
  data,
  isSelected,
  onSelect,
}: MoneyTypeCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      animate={{ scale: isSelected ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Card
        className={`cursor-pointer transition-all duration-200 ${
          isSelected
            ? "border-accent-gold ring-2 ring-accent-gold"
            : "hover:border-accent-gold/40"
        }`}
        onClick={onSelect}
      >
        <div className="text-3xl mb-2">{data.emoji}</div>
        <h3 className="font-serif text-xl text-text-primary mb-2">
          {data.name}
        </h3>
        <p className="font-sans text-text-secondary text-sm leading-relaxed">
          {data.description}
        </p>

        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-bg-secondary">
                <div className="mb-3">
                  <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-cat-green mb-1.5">
                    Strengths
                  </h4>
                  <ul className="space-y-1">
                    {data.strengths.map((s, i) => (
                      <li
                        key={i}
                        className="font-sans text-sm text-text-secondary flex items-start gap-1.5"
                      >
                        <span className="text-cat-green mt-0.5">+</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-accent-gold-deep mb-1.5">
                    Growth Edges
                  </h4>
                  <ul className="space-y-1">
                    {data.growthEdges.map((g, i) => (
                      <li
                        key={i}
                        className="font-sans text-sm text-text-secondary flex items-start gap-1.5"
                      >
                        <span className="text-accent-gold mt-0.5">~</span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
