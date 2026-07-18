"use server";

// Per-intent actions for the reflective trio (#52, ratified in #29):
// Money Scripts, Money Type, Money Dials. Data-layer only — the surfaces'
// keep/kill/merge verdicts are #25's; the entities' single home survives
// either verdict. Each write touches exactly one row, so a stale tab can
// never batch-clobber a partner's answers.

import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/lib/active-profile";
import type {
  DialCategory,
  MoneyType,
} from "@/lib/store/flow-store";

const MONEY_TYPES: ReadonlySet<string> = new Set([
  "OPTIMIZER",
  "AVOIDER",
  "WORRIER",
  "DREAMER",
]);

const DIAL_CATEGORIES: ReadonlySet<string> = new Set([
  "TRAVEL",
  "FOOD_DINING",
  "HEALTH_FITNESS",
  "CONVENIENCE",
  "TECHNOLOGY",
  "FASHION",
  "EXPERIENCES",
  "EDUCATION",
  "GIVING",
]);

export async function getReflectionData(): Promise<{
  scripts: Record<number, string>;
  moneyType: MoneyType | null;
  moneyDials: Record<string, number>;
} | null> {
  const profileId = await getActiveProfileId();
  if (!profileId) return null;

  const [profile, scripts, dials] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: profileId },
      select: { moneyType: true },
    }),
    prisma.moneyScript.findMany({
      where: { profileId },
      select: { promptId: true, response: true },
    }),
    prisma.moneyDial.findMany({
      where: { profileId },
      select: { category: true, level: true },
    }),
  ]);

  return {
    scripts: Object.fromEntries(
      scripts.map((s) => [s.promptId, s.response])
    ) as Record<number, string>,
    moneyType: (profile?.moneyType as MoneyType) ?? null,
    moneyDials: Object.fromEntries(dials.map((d) => [d.category, d.level])),
  };
}

export async function saveMoneyScript(
  promptId: number,
  response: string
): Promise<{ ok?: boolean; error?: string }> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };
  if (!Number.isInteger(promptId) || promptId < 0)
    return { error: "Unknown prompt." };
  if (response.length > 10_000) return { error: "That answer is too long." };

  await prisma.moneyScript.upsert({
    where: { profileId_promptId: { profileId, promptId } },
    update: { response },
    create: { profileId, promptId, response },
  });
  return { ok: true };
}

export async function saveMoneyType(
  moneyType: MoneyType
): Promise<{ ok?: boolean; error?: string }> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };
  if (!MONEY_TYPES.has(moneyType)) return { error: "Unknown Money Type." };

  await prisma.profile.update({
    where: { id: profileId },
    data: { moneyType },
  });
  return { ok: true };
}

export async function saveMoneyDial(
  category: DialCategory,
  level: number
): Promise<{ ok?: boolean; error?: string }> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { error: "Not signed in." };
  if (!DIAL_CATEGORIES.has(category)) return { error: "Unknown dial." };
  if (!Number.isInteger(level) || level < 0 || level > 10)
    return { error: "Dial level must be between 0 and 10." };

  await prisma.moneyDial.upsert({
    where: { profileId_category: { profileId, category } },
    update: { level },
    create: { profileId, category, level },
  });
  return { ok: true };
}
