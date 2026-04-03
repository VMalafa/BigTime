"use client";

import { type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

interface CardProps extends HTMLMotionProps<"div"> {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({
  header,
  footer,
  children,
  padding = "md",
  className = "",
  ...rest
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`bg-white rounded-xl border border-bg-secondary shadow-[0_2px_12px_rgba(61,43,31,0.08)] ${className}`}
      {...rest}
    >
      {header && (
        <div className="px-6 py-4 border-b border-bg-secondary font-serif text-text-primary">
          {header}
        </div>
      )}
      <div className={paddingClasses[padding]}>{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-bg-secondary">
          {footer}
        </div>
      )}
    </motion.div>
  );
}
