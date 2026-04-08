"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  manageHref?: string;
  manageLabel?: string;
  children?: ReactNode;
}

/**
 * Dashboard section heading with a consistent "manage" affordance so every
 * area of the plan is one click away from its editor.
 */
export function SectionHeader({
  title,
  manageHref,
  manageLabel = "Manage",
  children,
}: SectionHeaderProps) {
  return (
    <div className="flex items-baseline justify-between mb-3 gap-3">
      <h2 className="font-serif text-lg text-text-primary">{title}</h2>
      <div className="flex items-center gap-3">
        {children}
        {manageHref && (
          <Link href={manageHref} className="group">
            <motion.span
              whileHover={{ x: 2 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="inline-flex items-center gap-1 text-accent-gold text-sm font-sans font-medium hover:underline"
            >
              {manageLabel}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M5 3l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.span>
          </Link>
        )}
      </div>
    </div>
  );
}
