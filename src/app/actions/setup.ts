"use server";

// The One Flow's server truths (#73): the walk state is derived from what
// the household's data already proves — no stored step pointer anywhere —
// and the side-quest dismissal is a household decision that lives on the
// User row, never in localStorage.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  deriveSetupWalk,
  planStepHref,
  type SetupWalkState,
} from "@/lib/setup/walk";
import { getRequestUserId } from "@/lib/auth/request-user";

export interface SetupState extends SetupWalkState {
  hasLinkedAccount: boolean;
  sideQuestDismissed: boolean;
}

export async function getSetupState(): Promise<SetupState | null> {
  const userId = await getRequestUserId();
  if (!userId) return null;

  // One database round trip: existence flags as scalar subselects. This
  // runs on every setup-era page load, and the pooled single connection
  // pays full round-trip latency per query — so there is exactly one.
  const rows = await prisma.$queryRaw<
    {
      hasLinkedAccount: boolean;
      hasIncome: boolean;
      hasPlan: boolean;
      hasNamedDials: boolean;
      hasCostsOrDebts: boolean;
      automationOpen: bigint;
      sideQuestDismissed: boolean;
    }[]
  >`
    SELECT
      EXISTS(
        SELECT 1 FROM "LinkedAccount" la
        JOIN "AggregatorConnection" ac ON ac.id = la."connectionId"
        WHERE ac."userId" = ${userId} AND ac.status <> 'REVOKED'
      ) AS "hasLinkedAccount",
      (
        EXISTS(
          SELECT 1 FROM "IncomeSource" i
          JOIN "Profile" p ON p.id = i."profileId"
          WHERE p."userId" = ${userId}
        ) OR EXISTS(
          SELECT 1 FROM "ProposalDecision" d
          WHERE d."userId" = ${userId}
            AND d.kind = 'INCOME' AND d.decision = 'CONFIRMED'
        )
      ) AS "hasIncome",
      EXISTS(
        SELECT 1 FROM "SpendingPlan" sp
        JOIN "Profile" p ON p.id = sp."profileId"
        WHERE p."userId" = ${userId}
      ) AS "hasPlan",
      EXISTS(
        SELECT 1 FROM "MoneyDial" md
        JOIN "Profile" p ON p.id = md."profileId"
        WHERE p."userId" = ${userId}
      ) AS "hasNamedDials",
      (
        EXISTS(
          SELECT 1 FROM "Debt" db
          JOIN "Profile" p ON p.id = db."profileId"
          WHERE p."userId" = ${userId}
        ) OR EXISTS(
          SELECT 1 FROM "FixedCostLineItem" li
          JOIN "SpendingPlan" sp ON sp.id = li."spendingPlanId"
          JOIN "Profile" p ON p.id = sp."profileId"
          WHERE p."userId" = ${userId}
        )
      ) AS "hasCostsOrDebts",
      (
        SELECT COUNT(*) FROM "AutomationItem" ai
        WHERE ai."userId" = ${userId} AND ai."isCompleted" = false
      ) AS "automationOpen",
      COALESCE(
        (SELECT u."sideQuestDismissedAt" IS NOT NULL FROM "User" u
         WHERE u.id = ${userId}),
        false
      ) AS "sideQuestDismissed"
  `;
  const row = rows[0];

  const inputs = {
    hasLinkedAccount: row.hasLinkedAccount,
    hasIncome: row.hasIncome,
    hasPlan: row.hasPlan,
    hasNamedDials: row.hasNamedDials,
    hasCostsOrDebts: row.hasCostsOrDebts,
    automationDone: Number(row.automationOpen) === 0,
  };
  const walk = deriveSetupWalk(inputs);

  // The Plan step's inner pointer: CSP page first, then Dials.
  const steps = walk.steps.map((step) =>
    step.key === "PLAN"
      ? { ...step, href: planStepHref(inputs) }
      : step
  );
  const next = walk.next
    ? (steps.find((s) => s.key === walk.next!.key) ?? null)
    : null;

  return {
    ...walk,
    steps,
    next,
    hasLinkedAccount: inputs.hasLinkedAccount,
    sideQuestDismissed: row.sideQuestDismissed,
  };
}

/** Dismiss-forever for the "know yourselves" card; it moves to Settings. */
export async function dismissSideQuest(): Promise<{
  ok?: boolean;
  error?: string;
}> {
  const userId = await getRequestUserId();
  if (!userId) return { error: "Not signed in." };

  await prisma.user.update({
    where: { id: userId },
    data: { sideQuestDismissedAt: new Date() },
  });
  revalidatePath("/dashboard");
  return { ok: true };
}
