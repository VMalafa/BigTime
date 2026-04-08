"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useFlowStore, type FixedCostLineItem } from "@/lib/store/flow-store";
import {
  FIXED_COST_CATEGORIES,
  type FixedCostCategory,
} from "@/lib/constants/csp-ranges";
import { formatCurrency } from "@/lib/utils/format";

const CATEGORY_LABEL = new Map<FixedCostCategory, string>(
  FIXED_COST_CATEGORIES.map((c) => [c.key, c.label])
);

interface FixedCostLineItemListProps {
  items: FixedCostLineItem[];
  onEdit: (item: FixedCostLineItem) => void;
}

export function FixedCostLineItemList({
  items,
  onEdit,
}: FixedCostLineItemListProps) {
  const { removeFixedCostLineItem, reorderFixedCostLineItems } =
    useFlowStore();

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    [items]
  );

  const byCategory = useMemo(() => {
    const groups = new Map<FixedCostCategory, FixedCostLineItem[]>();
    for (const c of FIXED_COST_CATEGORIES) groups.set(c.key, []);
    for (const item of sorted) {
      groups.get(item.category)?.push(item);
    }
    return groups;
  }, [sorted]);

  function move(index: number, direction: -1 | 1) {
    const next = [...sorted];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    reorderFixedCostLineItems(next.map((i) => i.id));
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-text-secondary font-serif text-lg">
          No line items yet. Add your first obligation above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {FIXED_COST_CATEGORIES.map((c) => {
        const group = byCategory.get(c.key) ?? [];
        if (group.length === 0) return null;

        const groupTotal = group.reduce((s, i) => s + i.monthlyAmount, 0);

        return (
          <div key={c.key} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-serif text-base text-text-primary">
                {CATEGORY_LABEL.get(c.key) ?? c.label}
              </h3>
              <span className="text-sm text-text-secondary">
                {formatCurrency(groupTotal)}/mo
              </span>
            </div>

            <AnimatePresence mode="popLayout">
              {group.map((item) => {
                const globalIndex = sorted.findIndex((i) => i.id === item.id);
                const isFirst = globalIndex === 0;
                const isLast = globalIndex === sorted.length - 1;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Card>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-serif text-text-primary truncate">
                            {item.name}
                          </p>
                          <p className="text-lg font-semibold text-text-primary">
                            {formatCurrency(item.monthlyAmount)}
                            <span className="text-sm font-normal text-text-secondary">
                              /mo
                            </span>
                          </p>
                          {item.note && (
                            <p className="text-xs text-text-secondary truncate">
                              {item.note}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => move(globalIndex, -1)}
                              disabled={isFirst}
                              aria-label={`Move ${item.name} up`}
                            >
                              ↑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => move(globalIndex, 1)}
                              disabled={isLast}
                              aria-label={`Move ${item.name} down`}
                            >
                              ↓
                            </Button>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(item)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFixedCostLineItem(item.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
