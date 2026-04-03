"use client";

import { motion } from "framer-motion";
import { Slider } from "@/components/ui/Slider";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils/format";
import { formatPercent } from "@/lib/utils/format";
import type { JointSpendingPlanData } from "@/lib/store/partner-store";

interface JointCSPSlidersProps {
  values: JointSpendingPlanData;
  onChange: (updates: Partial<JointSpendingPlanData>) => void;
  totalJointIncome: number;
}

interface SliderConfig {
  key: keyof Pick<
    JointSpendingPlanData,
    | "jointFixedCostsPercent"
    | "jointSavingsPercent"
    | "jointInvestmentsPercent"
    | "jointGuiltFreePercent"
  >;
  label: string;
  color: string;
  description: string;
}

const SLIDERS: SliderConfig[] = [
  {
    key: "jointFixedCostsPercent",
    label: "Fixed Costs",
    color: "text-cat-terra",
    description: "Rent/mortgage, utilities, insurance, minimum debt payments",
  },
  {
    key: "jointSavingsPercent",
    label: "Savings",
    color: "text-cat-blue",
    description: "Emergency fund, short-term goals, vacation fund",
  },
  {
    key: "jointInvestmentsPercent",
    label: "Investments",
    color: "text-cat-green",
    description: "Retirement, brokerage, education funds",
  },
  {
    key: "jointGuiltFreePercent",
    label: "Guilt-Free Spending",
    color: "text-cat-plum",
    description: "Dining, entertainment, hobbies, fun money",
  },
];

export function JointCSPSliders({
  values,
  onChange,
  totalJointIncome,
}: JointCSPSlidersProps) {
  const totalPercent =
    values.jointFixedCostsPercent +
    values.jointSavingsPercent +
    values.jointInvestmentsPercent +
    values.jointGuiltFreePercent;

  const isOver = totalPercent > 100;

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-bg-secondary">
        <div className="text-center mb-2">
          <p className="font-sans text-xs text-text-secondary uppercase tracking-wide">
            Joint Pool
          </p>
          <p className="font-serif text-2xl text-text-primary">
            {formatCurrency(totalJointIncome)}
            <span className="text-sm text-text-secondary font-sans">
              /month
            </span>
          </p>
        </div>
      </Card>

      {SLIDERS.map((slider, i) => {
        const dollarAmount = Math.round(
          (values[slider.key] / 100) * totalJointIncome
        );

        return (
          <motion.div
            key={slider.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <div className="flex flex-col gap-1.5 mb-2">
              <div className="flex items-center justify-between">
                <span
                  className={`font-sans text-sm font-semibold ${slider.color}`}
                >
                  {slider.label}
                </span>
                <span className="font-sans text-sm text-text-primary font-medium">
                  {formatCurrency(dollarAmount)}
                </span>
              </div>
              <p className="font-sans text-xs text-text-secondary">
                {slider.description}
              </p>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={values[slider.key]}
              onChange={(val) => onChange({ [slider.key]: val })}
              formatValue={(v) => formatPercent(v)}
            />
          </motion.div>
        );
      })}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className={`text-center font-sans text-sm font-medium ${
          isOver
            ? "text-error"
            : totalPercent === 100
              ? "text-success"
              : "text-text-secondary"
        }`}
      >
        {isOver
          ? `Over budget by ${totalPercent - 100}%`
          : totalPercent === 100
            ? "Perfectly balanced!"
            : `${100 - totalPercent}% unallocated`}
      </motion.div>
    </div>
  );
}
