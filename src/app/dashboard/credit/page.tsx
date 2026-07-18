"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useDebts } from "@/lib/hooks/useDebts";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  loadCreditPlan,
  saveCreditPlan,
  type CreditPlanData,
} from "@/app/actions/credit-plan";
import { calculateCreditHealth } from "@/lib/calculations/credit-health";
import {
  buildCreditStrategy,
  type ActionPriority,
} from "@/lib/calculations/credit-strategy";
import { formatPercentExact } from "@/lib/utils/format";

const priorityStyles: Record<
  ActionPriority,
  { label: string; ring: string; badge: "terra" | "default" | "green" }
> = {
  high: {
    label: "High priority",
    ring: "border-l-cat-terra",
    badge: "terra",
  },
  medium: {
    label: "Medium priority",
    ring: "border-l-accent-gold",
    badge: "default",
  },
  low: {
    label: "Ongoing",
    ring: "border-l-cat-green",
    badge: "green",
  },
};

const categoryLabels: Record<string, string> = {
  PAYMENT_HISTORY: "Payment history",
  UTILIZATION: "Utilization",
  CREDIT_MIX: "Credit mix",
  ACCOUNT_AGE: "Account age",
  MONITORING: "Monitoring",
  FRAUD_PROTECTION: "Fraud protection",
};

const DEFAULT_PLAN: CreditPlanData = {
  currentScore: null,
  targetScore: null,
  targetUtilization: 10,
  monitoringEnrolled: false,
  autopayAllAccounts: false,
  frozenBureaus: false,
  notes: null,
};

export default function CreditDashboardPage() {
  const { isAuthenticated } = useAuth();
  const { debts } = useDebts();
  const [plan, setPlan] = useState<CreditPlanData>(DEFAULT_PLAN);
  const [isPending, startTransition] = useTransition();

  // Local form state for score inputs
  const [currentScore, setCurrentScore] = useState("");
  const [targetScore, setTargetScore] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;
    loadCreditPlan().then((data) => {
      if (data) {
        setPlan(data);
        setCurrentScore(data.currentScore?.toString() ?? "");
        setTargetScore(data.targetScore?.toString() ?? "");
      }
    });
  }, [isAuthenticated]);

  const creditHealth = useMemo(() => calculateCreditHealth(debts), [debts]);
  const strategy = useMemo(
    () =>
      buildCreditStrategy(debts, {
        autopayAllAccounts: plan?.autopayAllAccounts,
        monitoringEnrolled: plan?.monitoringEnrolled,
        frozenBureaus: plan?.frozenBureaus,
        targetUtilization: plan?.targetUtilization,
      }),
    [debts, plan]
  );

  function updatePlan(patch: Partial<CreditPlanData>) {
    const next = { ...plan, ...patch };
    setPlan(next);
    if (isAuthenticated) {
      startTransition(() => {
        saveCreditPlan(next);
      });
    }
  }

  function handleSaveScores() {
    const current = currentScore ? Number(currentScore) : null;
    const target = targetScore ? Number(targetScore) : null;
    updatePlan({ currentScore: current, targetScore: target });
  }

  const scoreDelta =
    plan.currentScore && plan.targetScore
      ? plan.targetScore - plan.currentScore
      : null;

  return (
    <div>
      <motion.h1
        className="font-serif text-3xl text-text-primary mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Credit Improvement Strategy
      </motion.h1>
      <p className="text-text-secondary font-sans text-sm mb-6">
        A prioritized plan based on your current debts and utilization.
      </p>

      {/* Summary */}
      <Card padding="lg" className="mb-6 border-l-4 border-l-accent-gold">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-text-secondary font-sans">
              Primary focus
            </p>
            <h2 className="font-serif text-xl text-text-primary mt-0.5">
              {strategy.primaryFocus}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-secondary font-sans">
              Current utilization
            </p>
            <p className="font-serif text-2xl text-text-primary">
              {formatPercentExact(creditHealth.aggregateUtilization)}
            </p>
          </div>
        </div>
        <p className="text-text-secondary text-sm font-sans mt-3">
          {strategy.summary}
        </p>
      </Card>

      {/* Score tracking */}
      <Card padding="lg" className="mb-6">
        <h3 className="font-serif text-lg text-text-primary mb-1">
          Score Tracking
        </h3>
        <p className="text-text-secondary text-sm font-sans mb-4">
          Enter your current credit score (from Credit Karma, your bank app,
          etc.) and a goal to track progress over time.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <Input
            label="Current Score"
            type="number"
            min={300}
            max={850}
            placeholder="e.g. 680"
            value={currentScore}
            onChange={(e) => setCurrentScore(e.target.value)}
          />
          <Input
            label="Target Score"
            type="number"
            min={300}
            max={850}
            placeholder="e.g. 780"
            value={targetScore}
            onChange={(e) => setTargetScore(e.target.value)}
          />
          <Button
            variant="primary"
            onClick={handleSaveScores}
            disabled={isPending}
          >
            Save scores
          </Button>
        </div>
        {scoreDelta !== null && scoreDelta > 0 && (
          <div className="mt-4 rounded-md bg-accent-gold/10 p-3">
            <p className="text-sm font-sans text-text-primary">
              You&apos;re aiming for a{" "}
              <span className="font-semibold text-accent-gold">
                +{scoreDelta} point
              </span>{" "}
              improvement. Following the action plan below typically moves
              scores 20-50 points within 2-3 statement cycles.
            </p>
          </div>
        )}
      </Card>

      {/* Foundations checklist */}
      <Card padding="lg" className="mb-6">
        <h3 className="font-serif text-lg text-text-primary mb-1">
          Foundations
        </h3>
        <p className="text-text-secondary text-sm font-sans mb-4">
          The three non-negotiables. Check these off and they disappear from
          your action plan.
        </p>
        <div className="space-y-2">
          <Toggle
            label="Autopay set up on every account (at least the minimum)"
            helper="Protects your payment history — 35% of your score."
            checked={plan.autopayAllAccounts}
            onChange={(v) => updatePlan({ autopayAllAccounts: v })}
          />
          <Toggle
            label="Enrolled in free credit monitoring"
            helper="Credit Karma, bank apps, or AnnualCreditReport.com."
            checked={plan.monitoringEnrolled}
            onChange={(v) => updatePlan({ monitoringEnrolled: v })}
          />
          <Toggle
            label="Credit frozen at all three bureaus"
            helper="Equifax, Experian, TransUnion — free and zero score impact."
            checked={plan.frozenBureaus}
            onChange={(v) => updatePlan({ frozenBureaus: v })}
          />
        </div>
      </Card>

      {/* Action plan */}
      <div className="mb-6">
        <h3 className="font-serif text-xl text-text-primary mb-3">
          Your Action Plan
        </h3>
        <div className="space-y-3">
          {strategy.actions.length === 0 ? (
            <Card padding="lg">
              <p className="text-text-primary font-sans">
                You&apos;re in great shape — no new actions recommended. Keep
                your autopay running and monitor for errors.
              </p>
            </Card>
          ) : (
            strategy.actions.map((action, index) => {
              const style = priorityStyles[action.priority];
              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <Card padding="lg" className={`border-l-4 ${style.ring}`}>
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <h4 className="font-serif text-lg text-text-primary flex-1 min-w-0">
                        {action.title}
                      </h4>
                      <Badge variant={style.badge}>{style.label}</Badge>
                    </div>
                    <p className="text-text-secondary text-sm font-sans mb-3">
                      {action.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs font-sans text-text-secondary flex-wrap">
                      <span>
                        <span className="text-text-primary font-medium">
                          {action.estimatedImpact}
                        </span>{" "}
                        impact
                      </span>
                      <span>·</span>
                      <span>{action.timeHorizon}</span>
                      <span>·</span>
                      <span>{categoryLabels[action.category]}</span>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Milestones */}
      <Card padding="lg" className="mb-6">
        <h3 className="font-serif text-lg text-text-primary mb-1">
          Utilization Milestones
        </h3>
        <p className="text-text-secondary text-sm font-sans mb-4">
          Each threshold is a recognized scoring tier.
        </p>
        <div className="space-y-2">
          {strategy.milestones.map((m) => (
            <div
              key={m.label}
              className="flex items-start gap-3 p-3 rounded-lg bg-bg-secondary/60"
            >
              <div
                className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                  m.reached
                    ? "bg-accent-gold border-accent-gold"
                    : "border-text-secondary/30 bg-white"
                }`}
              >
                {m.reached && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    className="text-white"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 5l2 2 4-4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p
                  className={`font-sans text-sm font-medium ${
                    m.reached ? "text-accent-gold" : "text-text-primary"
                  }`}
                >
                  {m.label}
                </p>
                <p className="text-xs text-text-secondary font-sans">
                  {m.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-between pt-6 border-t border-bg-secondary">
        <Link href="/dashboard">
          <Button variant="ghost" size="md">
            ← Back to dashboard
          </Button>
        </Link>
        <Link href="/dashboard/automation">
          <Button variant="secondary" size="md">
            Automation next steps →
          </Button>
        </Link>
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  helper: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ label, helper, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 p-3 rounded-lg bg-bg-secondary/60 w-full text-left hover:bg-bg-secondary transition-colors"
    >
      <div
        className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors ${
          checked
            ? "bg-accent-gold border-accent-gold"
            : "border-text-secondary/30 bg-white"
        }`}
      >
        {checked && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="text-white"
            aria-hidden="true"
          >
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <div className="flex-1">
        <p
          className={`text-sm font-sans font-medium ${
            checked ? "text-text-secondary line-through" : "text-text-primary"
          }`}
        >
          {label}
        </p>
        <p className="text-xs text-text-secondary font-sans mt-0.5">
          {helper}
        </p>
      </div>
    </button>
  );
}
