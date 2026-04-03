export interface CreditTip {
  id: string;
  message: string;
  condition: "high_utilization" | "moderate_utilization" | "low_automation" | "no_revolving" | "milestone_30" | "milestone_10" | "milestone_7" | "general";
  priority: number;
}

export const CREDIT_TIPS: CreditTip[] = [
  {
    id: "high-util",
    message: "Your credit utilization is above 30%. Your payoff plan will naturally bring this down — the Utilization-First strategy prioritizes this specifically.",
    condition: "high_utilization",
    priority: 1,
  },
  {
    id: "moderate-util",
    message: "Your utilization is between 10-30%. You're in a good range, and your payoff plan will push you toward the optimal zone (<10%).",
    condition: "moderate_utilization",
    priority: 2,
  },
  {
    id: "low-automation",
    message: "Setting up auto-pay for at least the minimum payment on every account protects your payment history — the single biggest factor in credit health.",
    condition: "low_automation",
    priority: 1,
  },
  {
    id: "no-revolving",
    message: "You don't have revolving debt — that means utilization isn't a factor for you. Focus on consistent, on-time payments for your installment loans.",
    condition: "no_revolving",
    priority: 3,
  },
  {
    id: "milestone-30",
    message: "You just crossed below 30% utilization! This is a significant threshold — credit scoring models view you more favorably now.",
    condition: "milestone_30",
    priority: 1,
  },
  {
    id: "milestone-10",
    message: "Below 10% utilization! You're now in 'good' territory. Most people with excellent credit keep utilization under 10%.",
    condition: "milestone_10",
    priority: 1,
  },
  {
    id: "milestone-7",
    message: "Under 7% utilization — you've reached the optimal zone. This is the sweet spot that credit-savvy people target.",
    condition: "milestone_7",
    priority: 1,
  },
  {
    id: "general-autopay",
    message: "Every automated payment is one less thing to worry about — and one more on-time payment on your record.",
    condition: "general",
    priority: 3,
  },
  {
    id: "general-mix",
    message: "Having a mix of credit types (revolving and installment) is a minor positive factor. Your existing accounts already contribute to this.",
    condition: "general",
    priority: 4,
  },
];
