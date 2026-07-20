"use client";

import { forwardRef, type InputHTMLAttributes, useId } from "react";

interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  minLabel?: string;
  maxLabel?: string;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      label,
      min = 0,
      max = 100,
      step = 1,
      value,
      onChange,
      showValue = true,
      formatValue = (v) => String(v),
      minLabel,
      maxLabel,
      className = "",
      id: externalId,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;

    const percentage = ((value - min) / (max - min)) * 100;

    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            {label && (
              <label
                htmlFor={id}
                className="font-sans text-sm font-medium text-text-primary"
              >
                {label}
              </label>
            )}
            {showValue && (
              <span className="font-sans text-sm font-semibold text-accent-gold-deep">
                {formatValue(value)}
              </span>
            )}
          </div>
        )}
        <input
          ref={ref}
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-bg-secondary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-gold [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(61,43,31,0.2)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent-gold [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-[0_2px_6px_rgba(61,43,31,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
          style={{
            background: `linear-gradient(to right, var(--accent-gold) 0%, var(--accent-gold) ${percentage}%, var(--bg-secondary) ${percentage}%, var(--bg-secondary) 100%)`,
          }}
          {...rest}
        />
        {(minLabel || maxLabel) && (
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-text-secondary">
              {minLabel ?? formatValue(min)}
            </span>
            <span className="font-sans text-xs text-text-secondary">
              {maxLabel ?? formatValue(max)}
            </span>
          </div>
        )}
      </div>
    );
  }
);

Slider.displayName = "Slider";
