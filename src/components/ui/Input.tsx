"use client";

import { forwardRef, type InputHTMLAttributes, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = "", id: externalId, ...rest }, ref) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const describedBy = [
      error ? errorId : null,
      helperText && !error ? helperId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="font-sans text-sm font-medium text-text-primary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full px-4 py-2.5 rounded-lg border bg-white font-sans text-text-primary placeholder:text-text-secondary/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-bg-primary ${
            error
              ? "border-error focus:ring-error"
              : "border-bg-secondary focus:border-accent-gold focus:ring-accent-gold"
          } ${className}`}
          {...rest}
        />
        {error && (
          <p id={errorId} className="text-sm text-error font-sans" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-sm text-text-secondary font-sans">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
