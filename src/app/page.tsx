// The public landing page — a Server Component since #109: no framer-motion,
// no client JS of its own, no auth check (the proxy matcher skips it). The
// hero's fade-up runs on load; below-fold sections reveal on scroll entry
// where CSS scroll-driven animations are supported, and simply render where
// they are not (reveal classes in globals.css).

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const philosophyCards = [
  {
    title: "No Shame",
    body: "Debt isn’t a moral failing. Your worth isn’t your net worth.",
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
  { icon: "📝", label: "Discover your money story" },
  { icon: "💰", label: "Build your spending plan" },
  { icon: "📊", label: "Create your payoff strategy" },
  { icon: "✨", label: "Automate and enjoy" },
];

const frameworks = [
  { name: "Ramit Sethi", insight: "Conscious Spending Plan" },
  { name: "Tiffany Aliche", insight: "Financial Wholeness" },
  { name: "Dana Miranda", insight: "You Don’t Need a Budget" },
  { name: "Morgan Housel", insight: "Psychology of Money" },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Hero ── */}
      <section className="bg-bg-primary">
        <div className="max-w-5xl mx-auto px-6 py-24 md:py-36 text-center">
          <h1 className="reveal-load font-serif text-5xl md:text-7xl text-text-primary leading-tight">
            Your Rich Life
          </h1>

          <p className="reveal-load reveal-load-1 mt-6 max-w-xl mx-auto text-lg md:text-xl text-text-secondary font-sans leading-relaxed">
            From financial anxiety to a clear, automated plan&nbsp;&mdash; in
            under 10&nbsp;minutes.
          </p>

          <div className="reveal-load reveal-load-2 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/flow">
              <Button size="lg">Start Your Rich Life</Button>
            </Link>
            <Link href="/auth/signup?redirectTo=/flow">
              <Button variant="secondary" size="lg">
                Sign Up to Save Progress
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Philosophy ── */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
          <p className="reveal-scroll font-serif text-2xl md:text-3xl text-text-primary text-center leading-snug max-w-2xl mx-auto">
            Money is emotional first, mathematical second.
          </p>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {philosophyCards.map((card) => (
              <div key={card.title} className="reveal-scroll">
                <Card padding="lg" className="h-full">
                  <h3 className="font-serif text-lg text-text-primary mb-2">
                    {card.title}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {card.body}
                  </p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="bg-bg-primary">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
          <h2 className="reveal-scroll font-serif text-3xl md:text-4xl text-text-primary text-center">
            How It Works
          </h2>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div
                key={step.label}
                className="reveal-scroll flex flex-col items-center text-center"
              >
                <span className="text-4xl mb-4">{step.icon}</span>
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent-gold/15 text-accent-gold-deep text-sm font-sans font-semibold mb-3">
                  {i + 1}
                </span>
                <p className="text-text-primary font-sans font-medium text-sm">
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Frameworks ── */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
          <h2 className="reveal-scroll font-serif text-3xl md:text-4xl text-text-primary text-center">
            Built on wisdom from:
          </h2>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {frameworks.map((fw) => (
              <div key={fw.name} className="reveal-scroll">
                <Card padding="md" className="h-full text-center">
                  <p className="font-serif text-text-primary font-semibold">
                    {fw.name}
                  </p>
                  <p className="mt-1 text-text-secondary text-sm">
                    {fw.insight}
                  </p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="bg-bg-primary">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
          <h2 className="reveal-scroll font-serif text-3xl md:text-4xl text-text-primary">
            Ready to start?
          </h2>

          <div className="reveal-scroll mt-8">
            <Link href="/flow">
              <Button size="lg">Begin Your Journey</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
