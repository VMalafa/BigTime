// The Bonus Plan (#89, CONTEXT.md): the household's standing, pre-committed
// windfall split — percentages over {target debt, Spotlight Goal, guilt-free},
// decided calmly in advance. Pure math here; persistence and household
// scoping live in the action layer.

export interface BonusSplitPercents {
  debtPercent: number;
  goalPercent: number;
  guiltFreePercent: number;
}

/** The ratified default (#63): 70% target debt / 15% Goal / 15% guilt-free. */
export const DEFAULT_BONUS_PLAN: BonusSplitPercents = {
  debtPercent: 70,
  goalPercent: 15,
  guiltFreePercent: 15,
};

/** Whole percentages, each 0–100, together exactly 100. */
export function validateBonusPlan(plan: BonusSplitPercents): string | null {
  const parts = [plan.debtPercent, plan.goalPercent, plan.guiltFreePercent];
  for (const part of parts) {
    if (!Number.isInteger(part) || part < 0 || part > 100) {
      return "Whole percentages between 0 and 100, please.";
    }
  }
  const total = parts.reduce((sum, p) => sum + p, 0);
  if (total !== 100) {
    return `The split must total 100% — it's at ${total}%.`;
  }
  return null;
}

export interface BonusSplitCents {
  debtCents: number;
  goalCents: number;
  guiltFreeCents: number;
}

/**
 * The Bonus Plan applied to real dollars. Goal and guilt-free shares round
 * half-up; the debt share absorbs the remainder so the three always sum to
 * the amount exactly. When the debt share is 0%, any rounding overshoot is
 * taken back from the larger of the other two instead of going negative.
 */
export function splitBonus(
  amountCents: number,
  plan: BonusSplitPercents
): BonusSplitCents {
  let goalCents = Math.round((amountCents * plan.goalPercent) / 100);
  let guiltFreeCents = Math.round((amountCents * plan.guiltFreePercent) / 100);
  let debtCents = amountCents - goalCents - guiltFreeCents;
  if (debtCents < 0) {
    if (goalCents >= guiltFreeCents) goalCents += debtCents;
    else guiltFreeCents += debtCents;
    debtCents = 0;
  }
  return { debtCents, goalCents, guiltFreeCents };
}
