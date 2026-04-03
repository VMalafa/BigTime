"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { MoneyRuleEntry } from "@/lib/store/partner-store";
import { generateId } from "@/lib/utils/validation";

interface MoneyRulesFormProps {
  rules: MoneyRuleEntry[];
  onAdd: (rule: MoneyRuleEntry) => void;
  onUpdate: (id: string, updates: Partial<MoneyRuleEntry>) => void;
  onRemove: (id: string) => void;
}

export function MoneyRulesForm({
  rules,
  onAdd,
  onUpdate,
  onRemove,
}: MoneyRulesFormProps) {
  const [customRuleText, setCustomRuleText] = useState("");

  const handleAddCustomRule = () => {
    if (!customRuleText.trim()) return;

    onAdd({
      id: generateId(),
      ruleText: customRuleText.trim(),
      ruleType: "CUSTOM",
      agreedByA: false,
      agreedByB: false,
    });
    setCustomRuleText("");
  };

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence mode="popLayout">
        {rules.map((rule) => (
          <motion.div
            key={rule.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="border-bg-secondary">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-sans text-sm text-text-primary leading-relaxed flex-1">
                    {rule.ruleText}
                  </p>
                  <button
                    onClick={() => onRemove(rule.id)}
                    className="text-text-secondary hover:text-error transition-colors text-sm font-sans shrink-0"
                    aria-label="Remove rule"
                  >
                    Remove
                  </button>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.agreedByA}
                      onChange={(e) =>
                        onUpdate(rule.id, { agreedByA: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-bg-secondary text-accent-gold focus:ring-accent-gold"
                    />
                    <span className="font-sans text-sm text-text-secondary">
                      Partner A agrees
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.agreedByB}
                      onChange={(e) =>
                        onUpdate(rule.id, { agreedByB: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-bg-secondary text-accent-gold focus:ring-accent-gold"
                    />
                    <span className="font-sans text-sm text-text-secondary">
                      Partner B agrees
                    </span>
                  </label>
                </div>

                {rule.agreedByA && rule.agreedByB && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1.5"
                  >
                    <span className="text-success text-sm">&#10003;</span>
                    <span className="font-sans text-xs text-success font-medium">
                      Both partners agree
                    </span>
                  </motion.div>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add custom rule */}
      <Card className="border-dashed border-accent-gold/30">
        <h3 className="font-serif text-lg text-text-primary mb-3">
          Add a Custom Rule
        </h3>
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="e.g., We save all bonuses before spending them"
              value={customRuleText}
              onChange={(e) => setCustomRuleText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCustomRule();
              }}
            />
          </div>
          <Button
            onClick={handleAddCustomRule}
            variant="secondary"
            disabled={!customRuleText.trim()}
          >
            Add
          </Button>
        </div>
      </Card>
    </div>
  );
}
