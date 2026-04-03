"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import {
  DebtInputTable,
  type DebtEntry,
  type DebtType,
} from "@/components/calculator/DebtInputTable";
import { ExtraPaymentSlider } from "@/components/calculator/ExtraPaymentSlider";
import { StrategyComparison } from "@/components/calculator/StrategyComparison";
import { AmortizationChart } from "@/components/calculator/AmortizationChart";
import { UtilizationTimeline } from "@/components/calculator/UtilizationTimeline";

interface StrategyResult {
  totalInterestPaid: number;
  totalMonths: number;
  payoffDate: string;
  schedule: Array<{ month: number; totalBalance: number }>;
  utilizationMilestones?: Array<{
    debtName: string;
    threshold: number;
    month: number;
  }>;
}

interface CalculationResults {
  avalanche: StrategyResult;
  snowball: StrategyResult;
  utilization: StrategyResult;
}

let debtIdCounter = 0;
function generateDebtId() {
  debtIdCounter += 1;
  return `debt-${Date.now()}-${debtIdCounter}`;
}

function createEmptyDebt(): DebtEntry {
  return {
    id: generateDebtId(),
    name: "",
    balance: 0,
    apr: 0,
    minimumPayment: 0,
    type: "CREDIT_CARD" as DebtType,
    creditLimit: null,
  };
}

export default function CalculatorPage() {
  const [debts, setDebts] = useState<DebtEntry[]>([]);
  const [extraPayment, setExtraPayment] = useState(0);
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState("avalanche");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(async (currentDebts: DebtEntry[], extra: number) => {
    const validDebts = currentDebts.filter(
      (d) => d.balance > 0 && d.minimumPayment > 0
    );

    if (validDebts.length === 0) {
      setResults(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/calculations/debt-payoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debts: validDebts.map((d) => ({
            name: d.name || "Unnamed Debt",
            balance: d.balance,
            apr: d.apr,
            minimumPayment: d.minimumPayment,
            type: d.type,
            creditLimit: d.creditLimit,
          })),
          extraMonthlyPayment: extra,
        }),
      });

      if (!response.ok) {
        throw new Error("Calculation failed");
      }

      const data = await response.json();
      setResults(data);
    } catch {
      setError("Could not calculate payoff. Please check your inputs.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchResults(debts, extraPayment);
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [debts, extraPayment, fetchResults]);

  function handleAddDebt() {
    setDebts((prev) => [...prev, createEmptyDebt()]);
  }

  function handleRemoveDebt(id: string) {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  }

  function handleUpdateDebt(
    id: string,
    field: keyof DebtEntry,
    value: string | number | null
  ) {
    setDebts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  }

  const selectedResult = results
    ? results[selectedStrategy as keyof CalculationResults]
    : null;

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="font-serif text-4xl sm:text-5xl text-text-primary mb-3">
            Debt Payoff Calculator
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Compare strategies and find the fastest path to debt freedom.
          </p>
        </motion.div>

        <div className="flex flex-col gap-8">
          {/* Debt Input Section */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card header={<h2 className="text-xl">Your Debts</h2>}>
              <DebtInputTable
                debts={debts}
                onAdd={handleAddDebt}
                onRemove={handleRemoveDebt}
                onUpdate={handleUpdateDebt}
              />
            </Card>
          </motion.div>

          {/* Extra Payment Slider */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card header={<h2 className="text-xl">Extra Monthly Payment</h2>}>
              <ExtraPaymentSlider
                value={extraPayment}
                onChange={setExtraPayment}
              />
            </Card>
          </motion.div>

          {/* Loading / Error States */}
          {loading && (
            <div className="text-center py-6">
              <div className="inline-block w-6 h-6 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
              <p className="text-text-secondary text-sm mt-2">Calculating...</p>
            </div>
          )}

          {error && (
            <div className="bg-error/10 border border-error/30 text-error text-sm rounded-lg px-4 py-3 text-center">
              {error}
            </div>
          )}

          {/* Strategy Comparison */}
          {!loading && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <h2 className="font-serif text-2xl text-text-primary mb-4">
                Payoff Strategies
              </h2>
              <StrategyComparison
                results={results}
                selectedStrategy={selectedStrategy}
                onSelectStrategy={setSelectedStrategy}
              />
            </motion.div>
          )}

          {/* Amortization Chart */}
          {selectedResult && selectedResult.schedule && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <Card>
                <AmortizationChart
                  schedule={selectedResult.schedule}
                  strategyName={
                    selectedStrategy.charAt(0).toUpperCase() +
                    selectedStrategy.slice(1)
                  }
                />
              </Card>
            </motion.div>
          )}

          {/* Utilization Timeline */}
          {selectedResult &&
            selectedResult.utilizationMilestones &&
            selectedStrategy === "utilization" &&
            !loading && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              >
                <Card
                  header={
                    <h2 className="text-xl">Credit Utilization Milestones</h2>
                  }
                >
                  <UtilizationTimeline
                    milestones={selectedResult.utilizationMilestones}
                  />
                </Card>
              </motion.div>
            )}
        </div>
      </div>
    </div>
  );
}
