"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TypeComparison } from "@/components/partner/TypeComparison";
import { usePartnerStore } from "@/lib/store/partner-store";
import { useFlowStore } from "@/lib/store/flow-store";
import { COUPLES_STEPS } from "@/types/partner";

export default function TypesPage() {
  const router = useRouter();
  const myMoneyType = useFlowStore((s) => s.moneyType);
  const partnerMoneyType = usePartnerStore((s) => s.partnerMoneyType);
  const setOnboardingStep = usePartnerStore((s) => s.setOnboardingStep);

  const [insight, setInsight] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  const handleGetInsight = async () => {
    if (!myMoneyType || !partnerMoneyType) return;

    setIsLoadingInsight(true);
    try {
      const response = await fetch("/api/ai/compatibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeA: myMoneyType,
          typeB: partnerMoneyType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setInsight(data.insight);
      } else {
        setInsight(
          "You and your partner bring complementary strengths to your financial relationship. The key is understanding each other's natural tendencies and building systems that honor both perspectives."
        );
      }
    } catch {
      setInsight(
        "You and your partner bring complementary strengths to your financial relationship. The key is understanding each other's natural tendencies and building systems that honor both perspectives."
      );
    } finally {
      setIsLoadingInsight(false);
    }
  };

  const handleContinue = () => {
    setOnboardingStep(1);
    router.push(COUPLES_STEPS[1].path);
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
          Your Money Types
        </h1>
        <p className="text-text-secondary font-sans">
          See how your financial personalities complement each other.
        </p>
      </motion.div>

      <TypeComparison
        typeA={myMoneyType ?? "OPTIMIZER"}
        typeB={partnerMoneyType ?? "DREAMER"}
        nameA="You"
        nameB="Your Partner"
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-8 flex flex-col items-center gap-4"
      >
        {!insight && (
          <Button
            onClick={handleGetInsight}
            disabled={isLoadingInsight}
            variant="secondary"
          >
            {isLoadingInsight
              ? "Analyzing compatibility..."
              : "Get Compatibility Insight"}
          </Button>
        )}

        {insight && (
          <Card className="w-full border-accent-gold/20">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                💡
              </span>
              <div>
                <h3 className="font-serif text-lg text-text-primary mb-2">
                  Compatibility Insight
                </h3>
                <p className="font-sans text-sm text-text-secondary leading-relaxed">
                  {insight}
                </p>
              </div>
            </div>
          </Card>
        )}

        <Button onClick={handleContinue} className="mt-4">
          Continue to Vision
        </Button>
      </motion.div>
    </div>
  );
}
