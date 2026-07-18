"use client";

import { Card } from "@/components/ui/Card";

interface ScriptPromptProps {
  id: number;
  prompt: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** Fires when the answer settles — the per-intent save point (#52). */
  onBlur?: (value: string) => void;
}

export function ScriptPrompt({
  id,
  prompt,
  placeholder,
  value,
  onChange,
  onBlur,
}: ScriptPromptProps) {
  return (
    <Card className="mb-4">
      <p className="font-sans text-text-primary text-base mb-3 leading-relaxed">
        <span className="font-medium">{id}.</span>{" "}
        {prompt.split("___").map((part, i, arr) =>
          i < arr.length - 1 ? (
            <span key={i}>
              {part}
              <span className="inline-block border-b-2 border-accent-gold w-24" />
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </p>
      <textarea
        className="w-full bg-bg-secondary rounded-lg p-3 font-sans text-text-primary placeholder:text-text-secondary/60 min-h-[100px] resize-y border-0 outline-none focus:ring-2 focus:ring-accent-gold transition-shadow duration-200"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur?.(e.target.value)}
        aria-label={prompt}
      />
    </Card>
  );
}
