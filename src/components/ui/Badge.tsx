"use client";

import { type ReactNode } from "react";

type BadgeVariant = "default" | "green" | "blue" | "terra" | "plum";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-accent-gold/15 text-accent-gold-deep",
  green: "bg-cat-green/15 text-cat-green",
  blue: "bg-cat-blue/15 text-cat-blue",
  terra: "bg-cat-terra/15 text-cat-terra",
  plum: "bg-cat-plum/15 text-cat-plum",
};

export function Badge({
  variant = "default",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-sans font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
