// Goals v1 (#86, ratified in #80): the pure half. Progress ownership
// (feed balance when linked, manual only when not), the Spotlight slice
// as an Earmark input, and idempotent Milestone detection keyed so a
// refetch can never double-fire.

export interface GoalInput {
  id: string;
  name: string;
  emoji: string | null;
  targetCents: number;
  /** The linked savings account's feed balance, cents; null = unlinked. */
  linkedBalanceCents: number | null;
  manualCents: number;
  isSpotlight: boolean;
  sliceCents: number;
}

/** Feed balance owns progress when linked; manual only until then. */
export function goalProgressCents(goal: GoalInput): number {
  return goal.linkedBalanceCents ?? goal.manualCents;
}

export function goalPercentFunded(goal: GoalInput): number {
  if (goal.targetCents <= 0) return 0;
  return Math.min(
    100,
    Math.floor((goalProgressCents(goal) / goal.targetCents) * 100)
  );
}

/** "🌺 Hawaii · 34% funded" — the river always ends on the goal. */
export function goalHorizonLabel(goal: GoalInput): string {
  const emoji = goal.emoji ? `${goal.emoji} ` : "";
  return `${emoji}${goal.name} · ${goalPercentFunded(goal)}% funded`;
}

/** The Spotlight slice as an Earmark row for the heartbeat: reserved
 * through the period (due its last day, so bills fund first). */
export function sliceEarmark(
  spotlight: GoalInput | null,
  periodEndExclusive: Date
): { name: string; amountCents: number; dueDate: Date } | null {
  if (!spotlight || spotlight.sliceCents <= 0) return null;
  return {
    name: `${spotlight.name} slice`,
    amountCents: spotlight.sliceCents,
    dueDate: new Date(periodEndExclusive.getTime() - 24 * 60 * 60 * 1000),
  };
}

// --- Milestone detection -------------------------------------------------

// v1 celebration budget: flat and small — the celebration is the point,
// not the amount. Flagged for ratification in the build issue.
export const CELEBRATION_BUDGET_CENTS = 5_000;

export interface MilestoneCandidate {
  kind: "GOAL_PERCENT" | "DEBT_THOUSAND" | "DEBT_PAYOFF" | "DEBT_BASELINE";
  key: string;
  title: string;
  detail?: string;
  celebrationBudgetCents: number;
  /** BASELINE rows anchor later crossings and never prompt. */
  silent?: boolean;
}

export interface MilestoneDetectInput {
  goals: GoalInput[];
  /** Total household debt, cents. */
  totalDebtCents: number;
  debts: { id: string; name: string; balanceCents: number }[];
  /** Natural keys already recorded (any status). */
  existingKeys: ReadonlySet<string>;
}

/**
 * Idempotent by construction: every Milestone's key is an absolute fact
 * ("goal g at 40%", "household debt under $12k", "debt d at zero"), so
 * re-running detection can only add facts not yet recorded. Debt-thousand
 * crossings anchor on a silent BASELINE row written the first time
 * detection sees the household, so history that predates the app never
 * fires a parade of stale celebrations.
 */
export function detectMilestones(
  input: MilestoneDetectInput
): MilestoneCandidate[] {
  const out: MilestoneCandidate[] = [];

  // (1) Each 10% of a Goal funded.
  for (const goal of input.goals) {
    const percent = goalPercentFunded(goal);
    for (let step = 10; step <= percent; step += 10) {
      const key = `goal:${goal.id}:${step}`;
      if (input.existingKeys.has(key)) continue;
      out.push({
        kind: "GOAL_PERCENT",
        key,
        title: `${goal.emoji ? `${goal.emoji} ` : ""}${goal.name} is ${step}% funded`,
        detail: `Every slice counted. Worth marking together.`,
        celebrationBudgetCents: CELEBRATION_BUDGET_CENTS,
      });
    }
  }

  // (2) Each $1,000 of household debt gone — downward crossings below the
  // recorded baseline floor.
  const currentFloor = Math.floor(input.totalDebtCents / 100_000);
  const baselineKeys = [...input.existingKeys].filter((k) =>
    k.startsWith("debt-floor:")
  );
  if (baselineKeys.length === 0) {
    if (input.totalDebtCents > 0) {
      out.push({
        kind: "DEBT_BASELINE",
        key: `debt-floor:${currentFloor}`,
        title: "Debt baseline recorded",
        celebrationBudgetCents: 0,
        silent: true,
      });
    }
  } else {
    const previousFloor = Math.min(
      ...baselineKeys.map((k) => Number(k.slice("debt-floor:".length)))
    );
    for (let floor = previousFloor - 1; floor >= currentFloor; floor--) {
      const key = `debt-floor:${floor}`;
      if (input.existingKeys.has(key)) continue;
      out.push({
        kind: "DEBT_THOUSAND",
        key,
        title: `Another $1,000 of debt gone`,
        detail: `The household total crossed under $${(floor + 1).toLocaleString("en-US")}k.`,
        celebrationBudgetCents: CELEBRATION_BUDGET_CENTS,
      });
    }
  }

  // (3) A debt reaching zero.
  for (const debt of input.debts) {
    if (debt.balanceCents > 0) continue;
    const key = `debt-zero:${debt.id}`;
    if (input.existingKeys.has(key)) continue;
    out.push({
      kind: "DEBT_PAYOFF",
      key,
      title: `${debt.name} is paid off`,
      detail: "A whole line gone. That deserves a real celebration.",
      celebrationBudgetCents: CELEBRATION_BUDGET_CENTS,
    });
  }

  return out;
}
