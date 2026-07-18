"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

// Nav end-state (#60): exactly four tabs — Home · Timeline · Spending · Plan
// — on desktop and mobile alike. Credit and Automation keep their routes but
// lose their slots (Automation is reachable from Settings until its One Flow
// merge lands); Settings and Check-In launch from Home.
const navItems: NavItem[] = [
  {
    label: "Home",
    href: "/dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 9.5L10 3l7 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 8.5V17h10V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Timeline",
    href: "/dashboard/timeline",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 8h14M7 2v4M13 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 12h3M6 14.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Spending",
    href: "/dashboard/spending",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 16V9M8 16V4M13 16v-6M17 16V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Plan",
    href: "/dashboard/plan",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 3v7l5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

// Sub-views that light up a parent tab: income and debts belong to the Plan
// section; the calendar ingestion surface is entered from the Timeline.
const sectionPrefixes: Record<string, string[]> = {
  "/dashboard/plan": ["/dashboard/plan", "/dashboard/income", "/dashboard/debts"],
  "/dashboard/timeline": ["/dashboard/timeline", "/dashboard/calendar"],
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    const prefixes = sectionPrefixes[href] ?? [href];
    return prefixes.some((prefix) => pathname.startsWith(prefix));
  };

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-bg-secondary fixed inset-y-0 left-0 z-30">
        <div className="px-6 py-6">
          <Link href="/dashboard" className="block">
            <h1 className="font-serif text-xl text-text-primary">
              Your Rich Life
            </h1>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ x: 2 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans transition-colors duration-150 ${
                    active
                      ? "bg-accent-gold/10 text-accent-gold font-medium"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {item.label}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t border-bg-secondary">
          <p className="text-xs text-text-secondary font-sans">
            Build your Rich Life
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-64 bg-bg-primary min-h-screen pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar — the same four tabs as desktop (#60) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-bg-secondary z-30">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-sans transition-colors ${
                  active
                    ? "text-accent-gold"
                    : "text-text-secondary"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
