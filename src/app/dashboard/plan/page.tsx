"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";

interface PlanArea {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
}

// The Plan section (#60) houses the five plan areas as sub-views. Income and
// debts point at their canonical dashboard surfaces (one surface per entity);
// fixed costs, the CSP, and the dials still live on the flow pages until the
// One Flow merge (#73) walks setup over canonical pages.
const planAreas: PlanArea[] = [
  {
    title: "Income",
    description: "Paychecks and bonuses — what the household brings in.",
    href: "/dashboard/income",
    icon: (
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 3v14M6 6h5a2.5 2.5 0 110 5H6l8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Debts",
    description: "Every balance in one honest list, feed-linked where it can be.",
    href: "/dashboard/debts",
    icon: (
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2v16M6 6h8M6 10h8M6 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Fixed Costs",
    description: "The bills that repeat — housing, utilities, subscriptions.",
    href: "/flow/fixed-costs",
    icon: (
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.5 7.5h7M6.5 10.5h7M6.5 13.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Conscious Spending Plan",
    description: "The four buckets — where each dollar is meant to go.",
    href: "/flow/spending-plan",
    icon: (
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 3v7h7M10 10l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Money Dials",
    description: "What you love spending on — turn it up, cut the rest.",
    href: "/flow/money-dials",
    icon: (
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 10l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1.25" fill="currentColor" />
      </svg>
    ),
  },
];

export default function PlanPage() {
  return (
    <div>
      <motion.h1
        className="font-serif text-3xl text-text-primary mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Plan
      </motion.h1>
      <p className="text-text-secondary font-sans text-sm mb-8">
        Everything your Rich Life is built on — a plan, not a restriction.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {planAreas.map((area, index) => (
          <motion.div
            key={area.href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.35 }}
          >
            <Link href={area.href} className="block h-full">
              <Card padding="lg" className="h-full transition-colors hover:border-accent-gold/40">
                <div className="flex items-start gap-4">
                  <span className="text-accent-gold shrink-0 mt-0.5">
                    {area.icon}
                  </span>
                  <div>
                    <h3 className="font-serif text-lg text-text-primary mb-1">
                      {area.title}
                    </h3>
                    <p className="text-text-secondary text-sm font-sans">
                      {area.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
