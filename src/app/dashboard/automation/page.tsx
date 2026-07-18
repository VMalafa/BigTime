"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useDebts } from "@/lib/hooks/useDebts";
import { useIncomeData } from "@/lib/hooks/useIncomeData";
import { useSpendingPlan } from "@/lib/hooks/useSpendingPlan";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  loadAutomationItems,
  addAutomationItem,
  toggleAutomationItem,
  removeAutomationItem,
  type AutomationItemData,
  type AutomationCategoryValue,
} from "@/app/actions/automation";
import { suggestAutomations } from "@/lib/calculations/automation-suggestions";

const categoryConfig: Record<
  AutomationCategoryValue,
  { label: string; color: "default" | "green" | "blue" | "terra" | "plum" }
> = {
  BILL_PAY: { label: "Bill Pay", color: "blue" },
  SAVINGS_TRANSFER: { label: "Savings", color: "green" },
  INVESTMENT_TRANSFER: { label: "Investing", color: "plum" },
  CREDIT_MONITORING: { label: "Credit Monitoring", color: "default" },
  CREDIT_PROTECTION: { label: "Credit Protection", color: "terra" },
};

export default function AutomationDashboardPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  // Server truth via the per-intent hooks (#53).
  const { debts } = useDebts();
  const { incomeSources, bonusItems } = useIncomeData();
  const { spendingPlan } = useSpendingPlan();

  const [items, setItems] = useState<AutomationItemData[]>([]);
  const [isPending, startTransition] = useTransition();
  // Counter for optimistic IDs — pure, no Date.now() during render.
  const tempIdCounter = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadAutomationItems().then((data) => setItems(data));
  }, [isAuthenticated]);

  const suggestions = useMemo(
    () => suggestAutomations({ debts, incomeSources, bonusItems, spendingPlan }),
    [debts, incomeSources, bonusItems, spendingPlan]
  );

  const existingTitles = useMemo(
    () => new Set(items.map((i) => i.title)),
    [items]
  );
  const visibleSuggestions = suggestions.filter(
    (s) => !existingTitles.has(s.title)
  );

  const completedCount = items.filter((i) => i.isCompleted).length;
  const totalCount = items.length;
  const percent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function handleAddSuggestion(key: string) {
    const suggestion = suggestions.find((s) => s.key === key);
    if (!suggestion) return;

    // Optimistic insert so the UI updates instantly — the server action
    // returns the canonical row which we'll swap in when it resolves.
    tempIdCounter.current += 1;
    const tempId = `temp-${key}-${tempIdCounter.current}`;
    const optimistic: AutomationItemData = {
      id: tempId,
      title: suggestion.title,
      description: suggestion.description,
      isCompleted: false,
      category: suggestion.category,
    };
    setItems((prev) => [...prev, optimistic]);

    if (isAuthenticated) {
      startTransition(async () => {
        const saved = await addAutomationItem({
          title: suggestion.title,
          description: suggestion.description,
          category: suggestion.category,
        });
        if (saved) {
          setItems((prev) =>
            prev.map((i) => (i.id === tempId ? saved : i))
          );
        }
      });
    }
  }

  function handleToggle(id: string, next: boolean) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isCompleted: next } : i))
    );
    if (isAuthenticated && !id.startsWith("temp-")) {
      startTransition(() => {
        toggleAutomationItem(id, next);
      });
    }
  }

  function handleRemove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (isAuthenticated && !id.startsWith("temp-")) {
      startTransition(() => {
        removeAutomationItem(id);
      });
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-text-secondary font-sans text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <motion.h1
        className="font-serif text-3xl text-text-primary mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Automation &amp; Next Steps
      </motion.h1>
      <p className="text-text-secondary font-sans text-sm mb-6">
        Turn your plan into a system that runs itself. Every automated action
        is one less thing to forget.
      </p>

      {/* Progress summary */}
      <Card padding="lg" className="mb-6 border-l-4 border-l-accent-gold">
        <div className="flex items-baseline justify-between flex-wrap gap-3 mb-3">
          <h2 className="font-serif text-lg text-text-primary">
            Automation progress
          </h2>
          <span className="font-serif text-2xl text-text-primary">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="h-2 rounded-full bg-bg-secondary overflow-hidden">
          <motion.div
            className="h-full bg-accent-gold"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
        <p className="text-text-secondary text-xs font-sans mt-2">
          {percent}% complete
          {totalCount === 0 && " — add suggestions below to build your list"}
        </p>
      </Card>

      {/* Suggested next steps */}
      {visibleSuggestions.length > 0 && (
        <div className="mb-8">
          <h3 className="font-serif text-xl text-text-primary mb-1">
            Suggested for you
          </h3>
          <p className="text-text-secondary text-sm font-sans mb-4">
            Based on your plan — tap to add to your checklist.
          </p>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {visibleSuggestions.map((s) => {
                const config = categoryConfig[s.category];
                return (
                  <motion.div
                    key={s.key}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card padding="lg">
                      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="font-serif text-lg text-text-primary">
                              {s.title}
                            </h4>
                            <Badge variant={config.color}>
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-text-secondary text-sm font-sans">
                            {s.description}
                          </p>
                          <p className="text-xs text-text-secondary font-sans mt-2 italic">
                            Suggested because: {s.rationale}
                          </p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAddSuggestion(s.key)}
                          disabled={isPending}
                        >
                          Add
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Your list */}
      <div className="mb-6">
        <h3 className="font-serif text-xl text-text-primary mb-1">
          Your automation list
        </h3>
        <p className="text-text-secondary text-sm font-sans mb-4">
          Check items off as you complete them.
        </p>
        {items.length === 0 ? (
          <Card padding="lg">
            <p className="text-text-primary font-sans text-sm">
              Nothing added yet. Pick from the suggestions above to start
              building your automation stack.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {items.map((item) => {
                const config = categoryConfig[item.category];
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="flex items-start gap-3 p-4 rounded-lg bg-white border border-bg-secondary"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggle(item.id, !item.isCompleted)}
                      className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors ${
                        item.isCompleted
                          ? "bg-accent-gold border-accent-gold"
                          : "border-text-secondary/30 bg-white"
                      }`}
                      aria-label={
                        item.isCompleted ? "Mark incomplete" : "Mark complete"
                      }
                    >
                      {item.isCompleted && (
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
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={`font-sans font-medium text-sm ${
                            item.isCompleted
                              ? "text-text-secondary line-through"
                              : "text-text-primary"
                          }`}
                        >
                          {item.title}
                        </p>
                        <Badge variant={config.color}>{config.label}</Badge>
                      </div>
                      {item.description && (
                        <p className="text-xs text-text-secondary font-sans mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(item.id)}
                    >
                      Remove
                    </Button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-bg-secondary">
        <Link href="/dashboard">
          <Button variant="ghost" size="md">
            ← Back to dashboard
          </Button>
        </Link>
        <Link href="/dashboard/credit">
          <Button variant="secondary" size="md">
            Credit strategy →
          </Button>
        </Link>
      </div>
    </div>
  );
}
