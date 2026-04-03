"use client";

import { MONEY_DIALS } from "@/lib/constants/money-dials";
import { MoneyDialSlider } from "@/components/flow/MoneyDialSlider";
import type { DialCategory } from "@/lib/store/flow-store";

interface MoneyDialsGridProps {
  values: Record<DialCategory, number>;
  onChange: (category: DialCategory, level: number) => void;
}

export function MoneyDialsGrid({ values, onChange }: MoneyDialsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {MONEY_DIALS.map((dial) => (
        <MoneyDialSlider
          key={dial.category}
          category={dial.category}
          name={dial.name}
          description={dial.description}
          icon={dial.icon}
          value={values[dial.category] ?? 5}
          onChange={(level) => onChange(dial.category, level)}
        />
      ))}
    </div>
  );
}
