"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { MONEY_TYPES, type MoneyTypeKey } from "@/lib/constants/money-types";

interface TypeComparisonProps {
  typeA: string;
  typeB: string;
  nameA: string;
  nameB: string;
}

export function TypeComparison({
  typeA,
  typeB,
  nameA,
  nameB,
}: TypeComparisonProps) {
  const moneyTypeA = MONEY_TYPES[typeA as MoneyTypeKey];
  const moneyTypeB = MONEY_TYPES[typeB as MoneyTypeKey];

  if (!moneyTypeA || !moneyTypeB) {
    return (
      <div className="text-center text-text-secondary font-sans py-8">
        Both partners need to complete the Money Type quiz first.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-cat-blue/30 h-full">
          <div className="text-center mb-4">
            <p className="font-sans text-sm text-text-secondary mb-1">
              {nameA}
            </p>
            <span className="text-4xl block mb-2">{moneyTypeA.emoji}</span>
            <h3 className="font-serif text-xl text-text-primary">
              {moneyTypeA.name}
            </h3>
          </div>
          <p className="font-sans text-sm text-text-secondary leading-relaxed mb-4">
            {moneyTypeA.description}
          </p>
          <div className="space-y-2">
            <p className="font-sans text-xs font-semibold text-cat-green uppercase tracking-wide">
              Strengths
            </p>
            <ul className="space-y-1">
              {moneyTypeA.strengths.map((s, i) => (
                <li
                  key={i}
                  className="font-sans text-xs text-text-secondary flex items-start gap-2"
                >
                  <span className="text-cat-green mt-0.5">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
          {moneyTypeA.partnerDynamics && (
            <div className="mt-4 rounded-lg bg-cat-blue/5 p-3">
              <p className="font-sans text-xs text-text-secondary italic leading-relaxed">
                {moneyTypeA.partnerDynamics}
              </p>
            </div>
          )}
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="border-cat-terra/30 h-full">
          <div className="text-center mb-4">
            <p className="font-sans text-sm text-text-secondary mb-1">
              {nameB}
            </p>
            <span className="text-4xl block mb-2">{moneyTypeB.emoji}</span>
            <h3 className="font-serif text-xl text-text-primary">
              {moneyTypeB.name}
            </h3>
          </div>
          <p className="font-sans text-sm text-text-secondary leading-relaxed mb-4">
            {moneyTypeB.description}
          </p>
          <div className="space-y-2">
            <p className="font-sans text-xs font-semibold text-cat-green uppercase tracking-wide">
              Strengths
            </p>
            <ul className="space-y-1">
              {moneyTypeB.strengths.map((s, i) => (
                <li
                  key={i}
                  className="font-sans text-xs text-text-secondary flex items-start gap-2"
                >
                  <span className="text-cat-green mt-0.5">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
          {moneyTypeB.partnerDynamics && (
            <div className="mt-4 rounded-lg bg-cat-terra/5 p-3">
              <p className="font-sans text-xs text-text-secondary italic leading-relaxed">
                {moneyTypeB.partnerDynamics}
              </p>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
