"use client";

// Money Dials — the canonical surface (#73 retired the /flow twin). Each
// slider settle is one awaited per-intent save, debounced per dial.

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useReflection, reflectionCache } from "@/lib/hooks/useReflection";
import { saveMoneyDial } from "@/app/actions/reflection";
import { MoneyDialsGrid } from "@/components/flow/MoneyDialsGrid";
import type { DialCategory } from "@/lib/store/flow-store";

// Per-dial save debounce: a slider drag emits many changes; the intent is
// "set this dial", awaited once the hand settles.
const DIAL_SAVE_DEBOUNCE_MS = 400;

export default function MoneyDialsPage() {
  const { moneyDials, setMoneyDialLocal: setMoneyDial } = useReflection();
  const [saveError, setSaveError] = useState<string | null>(null);
  const timersRef = useRef(new Map<DialCategory, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  // Server-authoritative (#52): the slider updates locally at drag speed;
  // each dial's awaited per-intent save fires when the hand settles, with
  // rollback to the last saved value on failure.
  const handleDialChange = (category: DialCategory, level: number) => {
    const previous = reflectionCache.get().moneyDials[category];
    setMoneyDial(category, level);

    const timers = timersRef.current;
    const pending = timers.get(category);
    if (pending) clearTimeout(pending);
    timers.set(
      category,
      setTimeout(async () => {
        timers.delete(category);
        const latest = reflectionCache.get().moneyDials[category];
        const result = await saveMoneyDial(category, latest);
        if (result.error) {
          setMoneyDial(category, previous);
          setSaveError(result.error);
        } else {
          setSaveError(null);
        }
      }, DIAL_SAVE_DEBOUNCE_MS)
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.h1
        className="font-serif text-3xl text-text-primary mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Money Dials
      </motion.h1>
      <p className="text-text-secondary font-sans text-sm mb-8">
        What do you love spending on? Turn those up — and name what you&apos;d
        happily cut.
      </p>

      <MoneyDialsGrid values={moneyDials} onChange={handleDialChange} />

      {saveError && (
        <p role="alert" className="text-sm text-error font-sans mt-4">
          {saveError}
        </p>
      )}
    </div>
  );
}
