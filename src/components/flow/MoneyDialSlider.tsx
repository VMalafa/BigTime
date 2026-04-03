"use client";

import { Card } from "@/components/ui/Card";
import { Slider } from "@/components/ui/Slider";

interface MoneyDialSliderProps {
  category: string;
  name: string;
  description: string;
  icon: string;
  value: number;
  onChange: (level: number) => void;
}

export function MoneyDialSlider({
  category,
  name,
  description,
  icon,
  value,
  onChange,
}: MoneyDialSliderProps) {
  const intensity = value / 10;

  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl" role="img" aria-label={name}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg text-text-primary leading-tight">
            {name}
          </h3>
          <p className="text-text-secondary text-sm leading-snug mt-0.5">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Slider
            min={1}
            max={10}
            step={1}
            value={value}
            onChange={onChange}
            showValue={false}
            minLabel="Meh"
            maxLabel="Love it"
          />
        </div>
        <span
          className="font-serif text-2xl font-bold min-w-[2.5rem] text-center transition-colors duration-200"
          style={{
            color: `color-mix(in srgb, var(--accent-gold) ${Math.round(40 + intensity * 60)}%, var(--text-secondary))`,
          }}
        >
          {value}
        </span>
      </div>
    </Card>
  );
}
