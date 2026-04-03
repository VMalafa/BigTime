"use client";

import { Slider } from "@/components/ui/Slider";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils/format";

interface ExtraPaymentSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const QUICK_SET_VALUES = [0, 50, 100, 250, 500];

export function ExtraPaymentSlider({
  value,
  onChange,
  min = 0,
  max = 1000,
}: ExtraPaymentSliderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <span className="font-serif text-3xl text-accent-gold">
          {formatCurrency(value)}
        </span>
        <p className="text-text-secondary text-sm mt-1">
          extra per month toward debt
        </p>
      </div>

      <Slider
        label="Extra Monthly Payment"
        min={min}
        max={max}
        step={25}
        value={value}
        onChange={onChange}
        formatValue={formatCurrency}
        showValue={false}
      />

      <div className="flex flex-wrap items-center justify-center gap-2">
        {QUICK_SET_VALUES.map((amount) => (
          <Button
            key={amount}
            variant={value === amount ? "primary" : "ghost"}
            size="sm"
            onClick={() => onChange(amount)}
          >
            {formatCurrency(amount)}
          </Button>
        ))}
      </div>
    </div>
  );
}
