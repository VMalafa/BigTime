"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SharedDebtMapper } from "@/components/partner/SharedDebtMapper";
import { usePartnerStore } from "@/lib/store/partner-store";
import { useFlowStore } from "@/lib/store/flow-store";
import { COUPLES_STEPS } from "@/types/partner";

export default function SharedDebtsPage() {
  const router = useRouter();
  const debts = useFlowStore((s) => s.debts);
  const sharedDebts = usePartnerStore((s) => s.sharedDebts);
  const toggleSharedDebt = usePartnerStore((s) => s.toggleSharedDebt);
  const setOnboardingStep = usePartnerStore((s) => s.setOnboardingStep);

  const handleContinue = () => {
    setOnboardingStep(4);
    router.push(COUPLES_STEPS[4].path);
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <h1 className="font-serif text-3xl text-text-primary mb-2">
          Shared vs. Individual Debts
        </h1>
        <p className="text-text-secondary font-sans">
          Decide which debts you tackle together and which stay individual.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <SharedDebtMapper
          debts={debts}
          sharedDebtIds={sharedDebts}
          onToggle={toggleSharedDebt}
        />
      </motion.div>

      <div className="flex justify-center mt-8">
        <Button onClick={handleContinue}>Continue to Joint Plan</Button>
      </div>
    </div>
  );
}
