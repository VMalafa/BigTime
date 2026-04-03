"use client";

import { type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AnimatedTransitionProps {
  children: ReactNode;
  direction?: "left" | "right";
}

export function AnimatedTransition({
  children,
  direction = "right",
}: AnimatedTransitionProps) {
  const xOffset = 20;
  const initialX = direction === "right" ? xOffset : -xOffset;
  const exitX = direction === "right" ? -xOffset : xOffset;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, x: initialX }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: exitX }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
