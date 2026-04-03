export const MONEY_TYPES = {
  OPTIMIZER: {
    name: "The Optimizer",
    emoji: "📊",
    description: "You love systems, spreadsheets, and maximizing every dollar. You get genuine joy from finding the best deal and optimizing your financial systems.",
    strengths: [
      "Naturally drawn to automation and systems",
      "Great at comparison shopping and finding value",
      "Enjoys the process of financial planning",
    ],
    growthEdges: [
      "Can over-optimize and miss the joy of spending",
      "May judge others' 'inefficient' spending",
      "Sometimes analysis paralysis on decisions",
    ],
    partnerDynamics: "Optimizers bring structure but need to leave room for spontaneity. Your partner may feel judged — lead with curiosity, not correction.",
    authorWisdom: "Ramit Sethi: 'Spend extravagantly on the things you love, and cut mercilessly on the things you don't.'",
  },
  AVOIDER: {
    name: "The Avoider",
    emoji: "🙈",
    description: "Money feels overwhelming, so you'd rather not look. Bills pile up, accounts go unchecked — not from laziness, but from genuine anxiety about what you'll find.",
    strengths: [
      "Often generous and present-focused",
      "Good at living in the moment",
      "Usually has untapped financial potential",
    ],
    growthEdges: [
      "Late payments from avoidance (affects credit)",
      "May not know actual account balances",
      "Surprise bills feel catastrophic",
    ],
    partnerDynamics: "Avoiders need a safe, judgment-free space to engage with money. Shame makes avoidance worse. Start with small wins.",
    authorWisdom: "Tiffany Aliche: 'You don't have to be perfect. You just have to be present.'",
  },
  WORRIER: {
    name: "The Worrier",
    emoji: "😟",
    description: "No matter how much you have, it never feels like enough. You check balances frequently, catastrophize about the future, and struggle to enjoy spending even when you can afford it.",
    strengths: [
      "Naturally cautious — rarely overspends",
      "Usually has emergency savings",
      "Pays attention to financial details",
    ],
    growthEdges: [
      "Difficulty enjoying guilt-free spending",
      "Over-saving at the expense of living",
      "Anxiety can lead to hoarding behavior",
    ],
    partnerDynamics: "Worriers need reassurance that the plan is solid. Share the numbers openly — mystery feeds anxiety. Celebrate security wins together.",
    authorWisdom: "Morgan Housel: 'The highest form of wealth is the ability to wake up every morning and say, I can do whatever I want today.'",
  },
  DREAMER: {
    name: "The Dreamer",
    emoji: "✨",
    description: "You love imagining the life you want to live and believe it will work out. Big vision, but the practical steps between here and there feel boring or overwhelming.",
    strengths: [
      "Clear vision of their Rich Life",
      "Optimistic and motivated by possibility",
      "Often creative with income generation",
    ],
    growthEdges: [
      "Gap between vision and daily habits",
      "May impulse-spend on 'future self' items",
      "Bored by budgets and tracking",
    ],
    partnerDynamics: "Dreamers need their vision validated, then gently connected to action steps. Don't crush the dream — build the bridge to it.",
    authorWisdom: "Dana Miranda: 'You deserve the life you want. And you can build it without shame.'",
  },
} as const;

export type MoneyTypeKey = keyof typeof MONEY_TYPES;
