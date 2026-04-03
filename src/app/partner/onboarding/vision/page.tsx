"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { VisionVennDiagram } from "@/components/partner/VisionVennDiagram";
import { usePartnerStore } from "@/lib/store/partner-store";
import type { RichLifeVisionEntry } from "@/lib/store/partner-store";
import { COUPLES_STEPS } from "@/types/partner";

const emptyVision: RichLifeVisionEntry = {
  year1: "",
  year5: "",
  year10: "",
  values: ["", "", ""],
};

export default function VisionPage() {
  const router = useRouter();
  const partnerAVision = usePartnerStore((s) => s.partnerAVision);
  const partnerBVision = usePartnerStore((s) => s.partnerBVision);
  const setPartnerAVision = usePartnerStore((s) => s.setPartnerAVision);
  const setPartnerBVision = usePartnerStore((s) => s.setPartnerBVision);
  const setOnboardingStep = usePartnerStore((s) => s.setOnboardingStep);

  const [visionA, setVisionA] = useState<RichLifeVisionEntry>(
    partnerAVision ?? { ...emptyVision, values: ["", "", ""] }
  );
  const [visionB, setVisionB] = useState<RichLifeVisionEntry>(
    partnerBVision ?? { ...emptyVision, values: ["", "", ""] }
  );

  const updateVisionAValue = (index: number, value: string) => {
    const newValues = [...visionA.values];
    newValues[index] = value;
    setVisionA({ ...visionA, values: newValues });
  };

  const updateVisionBValue = (index: number, value: string) => {
    const newValues = [...visionB.values];
    newValues[index] = value;
    setVisionB({ ...visionB, values: newValues });
  };

  const partnerAValues = useMemo(
    () => visionA.values.filter((v) => v.trim() !== ""),
    [visionA.values]
  );

  const partnerBValues = useMemo(
    () => visionB.values.filter((v) => v.trim() !== ""),
    [visionB.values]
  );

  const sharedValues = useMemo(() => {
    const aLower = partnerAValues.map((v) => v.toLowerCase().trim());
    const bLower = partnerBValues.map((v) => v.toLowerCase().trim());
    return partnerAValues.filter((v) =>
      bLower.includes(v.toLowerCase().trim())
    );
  }, [partnerAValues, partnerBValues]);

  const uniqueA = useMemo(
    () =>
      partnerAValues.filter(
        (v) =>
          !partnerBValues
            .map((b) => b.toLowerCase().trim())
            .includes(v.toLowerCase().trim())
      ),
    [partnerAValues, partnerBValues]
  );

  const uniqueB = useMemo(
    () =>
      partnerBValues.filter(
        (v) =>
          !partnerAValues
            .map((a) => a.toLowerCase().trim())
            .includes(v.toLowerCase().trim())
      ),
    [partnerAValues, partnerBValues]
  );

  const handleContinue = () => {
    setPartnerAVision(visionA);
    setPartnerBVision(visionB);
    setOnboardingStep(2);
    router.push(COUPLES_STEPS[2].path);
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
          Your Rich Life Vision
        </h1>
        <p className="text-text-secondary font-sans">
          Dream big together. Where do you each see your Rich Life heading?
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* Partner A */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="border-cat-blue/30 h-full">
            <h2 className="font-serif text-xl text-text-primary mb-4 text-center">
              Partner A
            </h2>
            <div className="flex flex-col gap-4">
              <Input
                label="1-Year Vision"
                placeholder="Where do you see your finances in 1 year?"
                value={visionA.year1}
                onChange={(e) =>
                  setVisionA({ ...visionA, year1: e.target.value })
                }
              />
              <Input
                label="5-Year Vision"
                placeholder="What does your Rich Life look like in 5 years?"
                value={visionA.year5}
                onChange={(e) =>
                  setVisionA({ ...visionA, year5: e.target.value })
                }
              />
              <Input
                label="10-Year Vision"
                placeholder="Your biggest financial dreams for 10 years out"
                value={visionA.year10}
                onChange={(e) =>
                  setVisionA({ ...visionA, year10: e.target.value })
                }
              />
              <div>
                <p className="font-sans text-sm font-medium text-text-primary mb-2">
                  Top Values
                </p>
                <div className="flex flex-col gap-2">
                  {visionA.values.map((val, i) => (
                    <Input
                      key={i}
                      placeholder={`Value ${i + 1} (e.g., freedom, security, adventure)`}
                      value={val}
                      onChange={(e) => updateVisionAValue(i, e.target.value)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Partner B */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="border-cat-terra/30 h-full">
            <h2 className="font-serif text-xl text-text-primary mb-4 text-center">
              Partner B
            </h2>
            <div className="flex flex-col gap-4">
              <Input
                label="1-Year Vision"
                placeholder="Where do you see your finances in 1 year?"
                value={visionB.year1}
                onChange={(e) =>
                  setVisionB({ ...visionB, year1: e.target.value })
                }
              />
              <Input
                label="5-Year Vision"
                placeholder="What does your Rich Life look like in 5 years?"
                value={visionB.year5}
                onChange={(e) =>
                  setVisionB({ ...visionB, year5: e.target.value })
                }
              />
              <Input
                label="10-Year Vision"
                placeholder="Your biggest financial dreams for 10 years out"
                value={visionB.year10}
                onChange={(e) =>
                  setVisionB({ ...visionB, year10: e.target.value })
                }
              />
              <div>
                <p className="font-sans text-sm font-medium text-text-primary mb-2">
                  Top Values
                </p>
                <div className="flex flex-col gap-2">
                  {visionB.values.map((val, i) => (
                    <Input
                      key={i}
                      placeholder={`Value ${i + 1} (e.g., freedom, security, adventure)`}
                      value={val}
                      onChange={(e) => updateVisionBValue(i, e.target.value)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Venn Diagram */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card className="mb-8">
          <h2 className="font-serif text-xl text-text-primary mb-6 text-center">
            Where Your Values Overlap
          </h2>
          <VisionVennDiagram
            partnerAValues={uniqueA}
            partnerBValues={uniqueB}
            sharedValues={sharedValues}
          />
        </Card>
      </motion.div>

      <div className="flex justify-center">
        <Button onClick={handleContinue}>Continue to Money Rules</Button>
      </div>
    </div>
  );
}
