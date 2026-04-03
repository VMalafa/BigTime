"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const stagger = {
  initial: "initial",
  whileInView: "animate",
  viewport: { once: true, margin: "-60px" },
  variants: {
    initial: {},
    animate: { transition: { staggerChildren: 0.1 } },
  },
};

const staggerChild = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const philosophyCards = [
  {
    title: "No Shame",
    body: "Debt isn\u2019t a moral failing. Your worth isn\u2019t your net worth.",
  },
  {
    title: "Systems Beat Willpower",
    body: "Automate the important stuff. Spend guilt-free on what you love.",
  },
  {
    title: "Together Is Better",
    body: "For individuals and couples. Build your Rich Life as a team.",
  },
];

const steps = [
  { icon: "\uD83D\uDCDD", label: "Discover your money story" },
  { icon: "\uD83D\uDCB0", label: "Build your spending plan" },
  { icon: "\uD83D\uDCCA", label: "Create your payoff strategy" },
  { icon: "\u2728", label: "Automate and enjoy" },
];

const frameworks = [
  { name: "Ramit Sethi", insight: "Conscious Spending Plan" },
  { name: "Tiffany Aliche", insight: "Financial Wholeness" },
  { name: "Dana Miranda", insight: "You Don\u2019t Need a Budget" },
  { name: "Morgan Housel", insight: "Psychology of Money" },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Hero ── */}
      <section className="bg-bg-primary">
        <div className="max-w-5xl mx-auto px-6 py-24 md:py-36 text-center">
          <motion.h1
            {...fadeUp}
            className="font-serif text-5xl md:text-7xl text-text-primary leading-tight"
          >
            Your Rich Life
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.15 }}
            className="mt-6 max-w-xl mx-auto text-lg md:text-xl text-text-secondary font-sans leading-relaxed"
          >
            From financial anxiety to a clear, automated plan&nbsp;&mdash; in
            under 10&nbsp;minutes.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/flow">
              <Button size="lg">Start Your Rich Life</Button>
            </Link>
            <Link href="/auth/signup?redirectTo=/flow">
              <Button variant="secondary" size="lg">
                Sign Up to Save Progress
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Philosophy ── */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
          <motion.p
            {...fadeUp}
            className="font-serif text-2xl md:text-3xl text-text-primary text-center leading-snug max-w-2xl mx-auto"
          >
            Money is emotional first, mathematical second.
          </motion.p>

          <motion.div
            {...stagger}
            className="mt-14 grid gap-6 md:grid-cols-3"
          >
            {philosophyCards.map((card) => (
              <motion.div key={card.title} variants={staggerChild}>
                <Card padding="lg" className="h-full">
                  <h3 className="font-serif text-lg text-text-primary mb-2">
                    {card.title}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {card.body}
                  </p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="bg-bg-primary">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
          <motion.h2
            {...fadeUp}
            className="font-serif text-3xl md:text-4xl text-text-primary text-center"
          >
            How It Works
          </motion.h2>

          <motion.div
            {...stagger}
            className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.label}
                variants={staggerChild}
                className="flex flex-col items-center text-center"
              >
                <span className="text-4xl mb-4">{step.icon}</span>
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent-gold/15 text-accent-gold text-sm font-sans font-semibold mb-3">
                  {i + 1}
                </span>
                <p className="text-text-primary font-sans font-medium text-sm">
                  {step.label}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Frameworks ── */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
          <motion.h2
            {...fadeUp}
            className="font-serif text-3xl md:text-4xl text-text-primary text-center"
          >
            Built on wisdom from:
          </motion.h2>

          <motion.div
            {...stagger}
            className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {frameworks.map((fw) => (
              <motion.div key={fw.name} variants={staggerChild}>
                <Card padding="md" className="h-full text-center">
                  <p className="font-serif text-text-primary font-semibold">
                    {fw.name}
                  </p>
                  <p className="mt-1 text-text-secondary text-sm">
                    {fw.insight}
                  </p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="bg-bg-primary">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
          <motion.h2
            {...fadeUp}
            className="font-serif text-3xl md:text-4xl text-text-primary"
          >
            Ready to start?
          </motion.h2>

          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.15 }}
            className="mt-8"
          >
            <Link href="/flow">
              <Button size="lg">Begin Your Journey</Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
