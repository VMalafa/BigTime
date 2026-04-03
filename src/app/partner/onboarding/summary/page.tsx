"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { usePartnerStore } from "@/lib/store/partner-store";
import { useFlowStore } from "@/lib/store/flow-store";
import { formatCurrency } from "@/lib/utils/format";
import { formatPercent } from "@/lib/utils/format";

export default function SummaryPage() {
  const router = useRouter();
  const jointPlan = usePartnerStore((s) => s.jointPlan);
  const moneyRules = usePartnerStore((s) => s.moneyRules);
  const sharedDebts = usePartnerStore((s) => s.sharedDebts);
  const partnerAVision = usePartnerStore((s) => s.partnerAVision);
  const partnerBVision = usePartnerStore((s) => s.partnerBVision);
  const debts = useFlowStore((s) => s.debts);

  const sharedDebtEntries = debts.filter((d) => sharedDebts.includes(d.id));
  const sharedDebtTotal = sharedDebtEntries.reduce(
    (sum, d) => sum + d.balance,
    0
  );

  const jointPoolIncome = jointPlan
    ? jointPlan.totalHouseholdIncome -
      jointPlan.partnerAPersonalAmount -
      jointPlan.partnerBPersonalAmount
    : 0;

  const agreedRules = moneyRules.filter((r) => r.agreedByA && r.agreedByB);

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <h1 className="font-serif text-3xl text-text-primary mb-2">
          Your Shared Rich Life Plan
        </h1>
        <p className="text-text-secondary font-sans">
          Here is everything you have built together.
        </p>
      </motion.div>

      {/* Joint CSP Summary */}
      {jointPlan && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-6"
        >
          <Card>
            <h2 className="font-serif text-xl text-text-primary mb-4">
              Joint Spending Plan
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <p className="font-sans text-xs text-text-secondary uppercase tracking-wide">
                  Fixed Costs
                </p>
                <p className="font-serif text-lg text-cat-terra">
                  {formatPercent(jointPlan.jointFixedCostsPercent)}
                </p>
                <p className="font-sans text-xs text-text-secondary">
                  {formatCurrency(
                    Math.round(
                      (jointPlan.jointFixedCostsPercent / 100) * jointPoolIncome
                    )
                  )}
                </p>
              </div>
              <div className="text-center">
                <p className="font-sans text-xs text-text-secondary uppercase tracking-wide">
                  Savings
                </p>
                <p className="font-serif text-lg text-cat-blue">
                  {formatPercent(jointPlan.jointSavingsPercent)}
                </p>
                <p className="font-sans text-xs text-text-secondary">
                  {formatCurrency(
                    Math.round(
                      (jointPlan.jointSavingsPercent / 100) * jointPoolIncome
                    )
                  )}
                </p>
              </div>
              <div className="text-center">
                <p className="font-sans text-xs text-text-secondary uppercase tracking-wide">
                  Investments
                </p>
                <p className="font-serif text-lg text-cat-green">
                  {formatPercent(jointPlan.jointInvestmentsPercent)}
                </p>
                <p className="font-sans text-xs text-text-secondary">
                  {formatCurrency(
                    Math.round(
                      (jointPlan.jointInvestmentsPercent / 100) *
                        jointPoolIncome
                    )
                  )}
                </p>
              </div>
              <div className="text-center">
                <p className="font-sans text-xs text-text-secondary uppercase tracking-wide">
                  Guilt-Free
                </p>
                <p className="font-serif text-lg text-cat-plum">
                  {formatPercent(jointPlan.jointGuiltFreePercent)}
                </p>
                <p className="font-sans text-xs text-text-secondary">
                  {formatCurrency(
                    Math.round(
                      (jointPlan.jointGuiltFreePercent / 100) * jointPoolIncome
                    )
                  )}
                </p>
              </div>
            </div>
            <div className="border-t border-bg-secondary pt-3 flex items-center justify-between">
              <span className="font-sans text-sm text-text-secondary">
                Household Income
              </span>
              <span className="font-sans text-sm font-semibold text-text-primary">
                {formatCurrency(jointPlan.totalHouseholdIncome)}/mo
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="font-sans text-sm text-text-secondary">
                Joint Pool
              </span>
              <span className="font-sans text-sm font-semibold text-accent-gold">
                {formatCurrency(Math.max(0, jointPoolIncome))}/mo
              </span>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Shared Debts */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mb-6"
      >
        <Card>
          <h2 className="font-serif text-xl text-text-primary mb-4">
            Shared Debts
          </h2>
          {sharedDebtEntries.length === 0 ? (
            <p className="font-sans text-sm text-text-secondary">
              No shared debts identified.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {sharedDebtEntries.map((debt) => (
                <div
                  key={debt.id}
                  className="flex items-center justify-between rounded-lg bg-bg-secondary/50 px-4 py-2"
                >
                  <span className="font-sans text-sm text-text-primary">
                    {debt.name}
                  </span>
                  <span className="font-sans text-sm text-text-secondary">
                    {formatCurrency(debt.balance)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-bg-secondary mt-1">
                <span className="font-sans text-sm font-medium text-text-primary">
                  Total Shared Debt
                </span>
                <span className="font-sans text-sm font-semibold text-accent-gold">
                  {formatCurrency(sharedDebtTotal)}
                </span>
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Money Rules */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mb-6"
      >
        <Card>
          <h2 className="font-serif text-xl text-text-primary mb-4">
            Money Rules
          </h2>
          {moneyRules.length === 0 ? (
            <p className="font-sans text-sm text-text-secondary">
              No money rules set.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {moneyRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-lg bg-bg-secondary/50 px-4 py-2"
                >
                  <span className="font-sans text-sm text-text-primary">
                    {rule.ruleText}
                  </span>
                  <Badge
                    variant={
                      rule.agreedByA && rule.agreedByB ? "green" : "terra"
                    }
                  >
                    {rule.agreedByA && rule.agreedByB
                      ? "Agreed"
                      : "Pending"}
                  </Badge>
                </div>
              ))}
              <p className="font-sans text-xs text-text-secondary mt-1">
                {agreedRules.length} of {moneyRules.length} rules agreed upon
              </p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Rich Life Vision */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="mb-8"
      >
        <Card>
          <h2 className="font-serif text-xl text-text-primary mb-4">
            Rich Life Vision
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-sans text-sm font-semibold text-cat-blue mb-2">
                Partner A
              </h3>
              {partnerAVision ? (
                <div className="flex flex-col gap-2">
                  {partnerAVision.year1 && (
                    <div>
                      <p className="font-sans text-xs text-text-secondary">
                        1 Year
                      </p>
                      <p className="font-sans text-sm text-text-primary">
                        {partnerAVision.year1}
                      </p>
                    </div>
                  )}
                  {partnerAVision.year5 && (
                    <div>
                      <p className="font-sans text-xs text-text-secondary">
                        5 Years
                      </p>
                      <p className="font-sans text-sm text-text-primary">
                        {partnerAVision.year5}
                      </p>
                    </div>
                  )}
                  {partnerAVision.year10 && (
                    <div>
                      <p className="font-sans text-xs text-text-secondary">
                        10 Years
                      </p>
                      <p className="font-sans text-sm text-text-primary">
                        {partnerAVision.year10}
                      </p>
                    </div>
                  )}
                  {partnerAVision.values.filter((v) => v).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {partnerAVision.values
                        .filter((v) => v)
                        .map((v, i) => (
                          <Badge key={i} variant="blue">
                            {v}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="font-sans text-sm text-text-secondary italic">
                  Not yet completed
                </p>
              )}
            </div>
            <div>
              <h3 className="font-sans text-sm font-semibold text-cat-terra mb-2">
                Partner B
              </h3>
              {partnerBVision ? (
                <div className="flex flex-col gap-2">
                  {partnerBVision.year1 && (
                    <div>
                      <p className="font-sans text-xs text-text-secondary">
                        1 Year
                      </p>
                      <p className="font-sans text-sm text-text-primary">
                        {partnerBVision.year1}
                      </p>
                    </div>
                  )}
                  {partnerBVision.year5 && (
                    <div>
                      <p className="font-sans text-xs text-text-secondary">
                        5 Years
                      </p>
                      <p className="font-sans text-sm text-text-primary">
                        {partnerBVision.year5}
                      </p>
                    </div>
                  )}
                  {partnerBVision.year10 && (
                    <div>
                      <p className="font-sans text-xs text-text-secondary">
                        10 Years
                      </p>
                      <p className="font-sans text-sm text-text-primary">
                        {partnerBVision.year10}
                      </p>
                    </div>
                  )}
                  {partnerBVision.values.filter((v) => v).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {partnerBVision.values
                        .filter((v) => v)
                        .map((v, i) => (
                          <Badge key={i} variant="terra">
                            {v}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="font-sans text-sm text-text-secondary italic">
                  Not yet completed
                </p>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={() => router.push("/dashboard")}
        >
          Start Building Together
        </Button>
      </div>
    </div>
  );
}
