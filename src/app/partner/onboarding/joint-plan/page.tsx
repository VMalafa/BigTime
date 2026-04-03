"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { JointCSPSliders } from "@/components/partner/JointCSPSliders";
import { usePartnerStore } from "@/lib/store/partner-store";
import { useFlowStore } from "@/lib/store/flow-store";
import { formatCurrency } from "@/lib/utils/format";
import type { JointSpendingPlanData } from "@/lib/store/partner-store";
import { COUPLES_STEPS } from "@/types/partner";

export default function JointPlanPage() {
  const router = useRouter();
  const jointPlan = usePartnerStore((s) => s.jointPlan);
  const setJointPlan = usePartnerStore((s) => s.setJointPlan);
  const setOnboardingStep = usePartnerStore((s) => s.setOnboardingStep);
  const getTotalMonthlyIncome = useFlowStore((s) => s.getTotalMonthlyIncome);

  const totalIncome = getTotalMonthlyIncome();

  const [plan, setPlan] = useState<JointSpendingPlanData>(
    jointPlan ?? {
      totalHouseholdIncome: totalIncome || 10000,
      partnerAPersonalAmount: 500,
      partnerBPersonalAmount: 500,
      jointFixedCostsPercent: 50,
      jointSavingsPercent: 10,
      jointInvestmentsPercent: 10,
      jointGuiltFreePercent: 30,
    }
  );

  const jointPoolIncome =
    plan.totalHouseholdIncome -
    plan.partnerAPersonalAmount -
    plan.partnerBPersonalAmount;

  const handleChange = (updates: Partial<JointSpendingPlanData>) => {
    setPlan((prev) => ({ ...prev, ...updates }));
  };

  const handleContinue = () => {
    setJointPlan(plan);
    setOnboardingStep(5);
    router.push(COUPLES_STEPS[5].path);
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
          Your Household Spending Plan
        </h1>
        <p className="text-text-secondary font-sans">
          Pool your resources and decide how to allocate them together.
        </p>
      </motion.div>

      {/* Income and personal allocations */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-8"
      >
        <Card>
          <h2 className="font-serif text-xl text-text-primary mb-4">
            Household Income
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Total Household Income"
              type="number"
              value={plan.totalHouseholdIncome}
              onChange={(e) =>
                handleChange({
                  totalHouseholdIncome: Number(e.target.value) || 0,
                })
              }
              helperText="Combined monthly after-tax income"
            />
            <Input
              label="Partner A Personal"
              type="number"
              value={plan.partnerAPersonalAmount}
              onChange={(e) =>
                handleChange({
                  partnerAPersonalAmount: Number(e.target.value) || 0,
                })
              }
              helperText="No-questions-asked allowance"
            />
            <Input
              label="Partner B Personal"
              type="number"
              value={plan.partnerBPersonalAmount}
              onChange={(e) =>
                handleChange({
                  partnerBPersonalAmount: Number(e.target.value) || 0,
                })
              }
              helperText="No-questions-asked allowance"
            />
          </div>
          <div className="mt-4 pt-4 border-t border-bg-secondary text-center">
            <p className="font-sans text-sm text-text-secondary">
              Joint Pool:{" "}
              <span className="font-semibold text-accent-gold">
                {formatCurrency(Math.max(0, jointPoolIncome))}
              </span>{" "}
              / month
            </p>
          </div>
        </Card>
      </motion.div>

      {/* Joint CSP Sliders */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mb-8"
      >
        <JointCSPSliders
          values={plan}
          onChange={handleChange}
          totalJointIncome={Math.max(0, jointPoolIncome)}
        />
      </motion.div>

      <div className="flex justify-center">
        <Button onClick={handleContinue}>Continue to Summary</Button>
      </div>
    </div>
  );
}
