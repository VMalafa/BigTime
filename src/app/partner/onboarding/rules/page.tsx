"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { MoneyRulesForm } from "@/components/partner/MoneyRulesForm";
import { usePartnerStore } from "@/lib/store/partner-store";
import type { MoneyRuleEntry } from "@/lib/store/partner-store";
import { generateId } from "@/lib/utils/validation";
import { COUPLES_STEPS } from "@/types/partner";

const DEFAULT_RULES: MoneyRuleEntry[] = [
  {
    id: "default-spending-threshold",
    ruleText: "We discuss purchases over $___",
    ruleType: "SPENDING_THRESHOLD",
    agreedByA: false,
    agreedByB: false,
  },
  {
    id: "default-review-cadence",
    ruleText: "We review our finances every ___",
    ruleType: "REVIEW_CADENCE",
    agreedByA: false,
    agreedByB: false,
  },
  {
    id: "default-personal-allowance",
    ruleText: "Each person gets $__ no-questions-asked per month",
    ruleType: "PERSONAL_ALLOWANCE",
    agreedByA: false,
    agreedByB: false,
  },
];

export default function RulesPage() {
  const router = useRouter();
  const moneyRules = usePartnerStore((s) => s.moneyRules);
  const addMoneyRule = usePartnerStore((s) => s.addMoneyRule);
  const updateMoneyRule = usePartnerStore((s) => s.updateMoneyRule);
  const removeMoneyRule = usePartnerStore((s) => s.removeMoneyRule);
  const setOnboardingStep = usePartnerStore((s) => s.setOnboardingStep);

  useEffect(() => {
    if (moneyRules.length === 0) {
      DEFAULT_RULES.forEach((rule) => addMoneyRule(rule));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = (rule: MoneyRuleEntry) => {
    addMoneyRule(rule);
  };

  const handleUpdate = (id: string, updates: Partial<MoneyRuleEntry>) => {
    updateMoneyRule(id, updates);
  };

  const handleRemove = (id: string) => {
    removeMoneyRule(id);
  };

  const handleContinue = () => {
    setOnboardingStep(3);
    router.push(COUPLES_STEPS[3].path);
  };

  const allAgreed =
    moneyRules.length > 0 &&
    moneyRules.every((r) => r.agreedByA && r.agreedByB);

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <h1 className="font-serif text-3xl text-text-primary mb-2">
          Your Money Rules
        </h1>
        <p className="text-text-secondary font-sans">
          Agree on the rules of engagement for your shared finances.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <MoneyRulesForm
          rules={moneyRules}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="flex flex-col items-center gap-3 mt-8"
      >
        {allAgreed && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-sans text-sm text-success font-medium"
          >
            All rules agreed upon. Nice teamwork!
          </motion.p>
        )}
        <Button onClick={handleContinue}>Continue to Shared Debts</Button>
      </motion.div>
    </div>
  );
}
