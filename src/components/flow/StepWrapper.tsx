"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface StepWrapperProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function StepWrapper({ title, subtitle, children }: StepWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-2xl mx-auto px-4 py-8"
    >
      <h1 className="font-serif text-3xl text-text-primary mb-2">{title}</h1>
      <p className="text-text-secondary mb-8">{subtitle}</p>
      {children}
    </motion.div>
  );
}
