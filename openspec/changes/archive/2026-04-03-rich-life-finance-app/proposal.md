# Proposal: Your Rich Life — Financial Wellness App

## Summary

Build a personal finance web app that guides individuals and couples from financial anxiety to a clear, automated plan — in under 10 minutes. The app synthesizes frameworks from Ramit Sethi, Tiffany Aliche, Dana Miranda, and Morgan Housel into a warm, shame-free guided experience that treats money as emotional first, mathematical second.

## Problem

Most financial tools are either cold dashboards that assume you already know what you're doing, or they shame people into restrictive budgets that don't stick. For couples, the problem compounds — 44% wish they shared a more similar financial mindset, yet 36% admit their partner doesn't have a full picture of their finances. No tool exists that:

1. Surfaces unconscious money beliefs before jumping to spreadsheets
2. Builds a spending plan that includes guilt-free joy (not just restriction)
3. Shows credit score improvement as an emergent benefit of the plan — not a separate lecture
4. Helps couples with different money psychologies build a shared plan where both feel heard
5. Uses AI as a warm counselor rather than a cold optimizer

## Solution

A Next.js web application with five core experiences:

### 1. Guided Onboarding Flow (Solo)
Walk a user from stress to clarity through five steps:
- **Money Psychology Discovery** — Invisible Money Scripts (5 fill-in-the-blank prompts about childhood beliefs) + Money Type self-identification (Optimizer, Avoider, Worrier, Dreamer)
- **Full Financial Picture** — Debt inventory (name, balance, APR, minimum payment, credit limit for revolving) + income sources. No judgment.
- **Conscious Spending Plan** — Ramit's 4-bucket system with interactive sliders: Fixed Costs (50-60%), Savings (5-10%), Investments (5-10%), Guilt-Free Spending (20-35%). Must total 100%.
- **Money Dials** — Within guilt-free spending, dial up what you love (travel, food, health, etc.), cut what you don't care about
- **Your Plan** — Summary dashboard: Financial Wholeness Score (0-100%), CSP breakdown, debt payoff strategy comparison (Snowball vs Avalanche vs Utilization-First), Credit Health Snapshot, automation checklist, personalized author wisdom

### 2. Partner Mode
Two people link accounts and work through a couples onboarding flow:
- Share Money Types side-by-side with AI-generated compatibility insights
- Design a Rich Life Vision together (Venn diagram of overlapping values)
- Set shared Money Rules (spending thresholds, review cadence, no-questions-asked amounts)
- Map shared vs. individual debts and income
- Build a Joint Conscious Spending Plan (joint pool + personal allocations)
- AI Couples Counselor acts as warm, neutral mediator throughout

Privacy is non-negotiable: individual data is private by default, sharing is always opt-in and revocable, and the AI never references private data in shared contexts.

### 3. Persistent Dashboard
Home base showing: wholeness score, CSP status, debt payoff progress over time, Credit Health card (utilization trend, on-time payment streak, credit report check reminder), and monthly check-in prompt.

### 4. Standalone Debt Payoff Calculator
Enter debts, compare three strategies (Snowball, Avalanche, Utilization-First), slide extra monthly payment to see timeline changes. Full amortization projections with charts and utilization milestones.

### 5. AI-Powered Features (Claude API)
- **Script Reflection** — Warm, therapeutic-toned reflection on money script patterns
- **Plan Review** — Personalized suggestions including credit health observations
- **Monthly Check-In** — Guided reflection with credit-relevant prompts
- **Couples Counselor** — Neutral financial mediator for Partner Mode

### 6. Credit Score Engine (Underlying Layer)
Not a separate module — a persistent intelligence layer that translates every financial action into credit impact. Tracks utilization ratios, payment automation coverage, debt mix, and surfaces contextual nudges throughout the app.

## Goals

- **User completes guided flow in <10 minutes** and leaves feeling lighter, not heavier
- **Couples move from avoidance/conflict to shared plan** with both partners feeling heard
- **Zero shame** — debt is normalized, imperfection is expected, systems beat willpower
- **Credit improvement is emergent** — users discover their plan is already a credit strategy
- **Works without auth** — localStorage for onboarding, account creation to save permanently
- **Mobile-first** — personal finance tool people use on their phones

## Non-Goals

- No ads, affiliate links, or product recommendations (including credit cards, lenders, monitoring services)
- No actual credit score display or credit report pulling
- No bank account linking or transaction import (manual entry only for v1)
- No payment processing or financial transactions
- No social features beyond Partner Mode

## Success Metrics

- Onboarding completion rate >70%
- Partner Mode link acceptance rate >50%
- Monthly check-in return rate >40%
- Financial Wholeness Score improvement over 3 months
- User-reported reduction in money anxiety (qualitative)
