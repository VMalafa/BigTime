"use server";

import { revalidatePath } from "next/cache";

import { getBankDataAccess, requireBankDataUser } from "@/lib/aggregator/access";
import { AggregatorError } from "@/lib/aggregator/provider";
import { sealSecret } from "@/lib/aggregator/secret-box";
import {
  AGGREGATOR_PROVIDER_NAME,
  getAggregatorProvider,
} from "@/lib/aggregator/simplefin";
import { syncConnection, syncConnectionsForUser } from "@/lib/aggregator/sync";
import { prisma } from "@/lib/prisma";
import type { DebtType } from "@prisma/client";

// Server actions for the connections surface. Every action re-checks AAL2
// server-side (requireBankDataUser) — actions are reachable via direct POST,
// so client-side gating alone is never trusted.

const CONNECTIONS_PATH = "/settings/connections";
const NOT_ALLOWED =
  "Bank data is locked behind two-factor verification. Refresh the page to verify.";
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;

// Best-effort in-process record of manual refresh attempts, so failed syncs
// can't be hammered. Successful syncs are also covered across instances by
// each connection's persisted lastSyncAt.
const manualRefreshAttempts = new Map<string, number>();

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function linkConnection(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireBankDataUser();
  if (!user) return { error: NOT_ALLOWED };

  const setupToken = (formData.get("setupToken") as string | null)?.trim();
  if (!setupToken) {
    return { error: "Paste the setup token from SimpleFIN Bridge." };
  }

  // Claim immediately; the setup token is single-use and never persisted.
  let accessSecret: string;
  try {
    ({ accessSecret } = await getAggregatorProvider().claim(setupToken));
  } catch (error) {
    return {
      error:
        error instanceof AggregatorError
          ? error.message
          : "Something went wrong while claiming the token. Please try again.",
    };
  }

  let encryptedAccessSecret: string;
  try {
    encryptedAccessSecret = sealSecret(accessSecret);
  } catch {
    // Misconfigured/missing AGGREGATOR_TOKEN_KEY. Nothing was persisted; the
    // claimed token is discarded and the household can re-link once fixed.
    return {
      error:
        "This server isn't configured for bank linking yet (encryption key missing). Nothing was saved — please try again after it's set up.",
    };
  }

  const connection = await prisma.aggregatorConnection.create({
    data: {
      userId: user.id,
      provider: AGGREGATOR_PROVIDER_NAME,
      encryptedAccessSecret,
    },
    select: { id: true },
  });

  // Initial sync so discovered accounts appear right away. A failure here is
  // already recorded on the connection and surfaced by its health banner.
  await syncConnection(connection.id);

  revalidatePath(CONNECTIONS_PATH);
  return { success: true };
}

export async function refreshNow(): Promise<ActionResult> {
  const user = await requireBankDataUser();
  if (!user) return { error: NOT_ALLOWED };

  const connections = await prisma.aggregatorConnection.findMany({
    where: { userId: user.id, status: { not: "REVOKED" } },
    select: { lastSyncAt: true },
  });
  if (connections.length === 0) {
    return { error: "No connections to refresh yet." };
  }

  const lastSync = Math.max(
    manualRefreshAttempts.get(user.id) ?? 0,
    ...connections.map((c) => c.lastSyncAt?.getTime() ?? 0)
  );
  const elapsed = Date.now() - lastSync;
  if (elapsed < REFRESH_COOLDOWN_MS) {
    const minutesLeft = Math.ceil((REFRESH_COOLDOWN_MS - elapsed) / 60_000);
    return {
      error: `Recently refreshed — try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}. SimpleFIN updates roughly daily, so there's no rush.`,
    };
  }

  manualRefreshAttempts.set(user.id, Date.now());
  await syncConnectionsForUser(user.id);
  revalidatePath(CONNECTIONS_PATH);
  return { success: true };
}

export async function deleteConnection(connectionId: string): Promise<ActionResult> {
  const user = await requireBankDataUser();
  if (!user) return { error: NOT_ALLOWED };

  const connection = await prisma.aggregatorConnection.findFirst({
    where: { id: connectionId, userId: user.id },
    select: { id: true },
  });
  if (!connection) return { error: "Connection not found." };

  // Deleting the connection deletes the encrypted secret and (via cascade)
  // its linked accounts and transactions. Mapped Debts revert to manual
  // editing and keep their last synced balance.
  await prisma.aggregatorConnection.delete({ where: { id: connection.id } });

  revalidatePath(CONNECTIONS_PATH);
  return { success: true };
}

async function findOwnedAccount(userId: string, accountId: string) {
  return prisma.linkedAccount.findFirst({
    where: { id: accountId, connection: { userId } },
  });
}

export async function setAccountOwner(
  accountId: string,
  profileId: string | null
): Promise<ActionResult> {
  const user = await requireBankDataUser();
  if (!user) return { error: NOT_ALLOWED };

  const account = await findOwnedAccount(user.id, accountId);
  if (!account) return { error: "Account not found." };

  if (profileId) {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId: user.id },
      select: { id: true },
    });
    if (!profile) return { error: "Profile not found." };
  }

  await prisma.linkedAccount.update({
    where: { id: account.id },
    data: { profileId },
  });

  revalidatePath(CONNECTIONS_PATH);
  return { success: true };
}

// Only liability feeds map onto Debts, and only onto type-compatible ones.
const MAPPABLE_DEBT_TYPES: Record<string, DebtType[]> = {
  CREDIT_CARD: ["CREDIT_CARD", "OTHER_REVOLVING"],
  LOAN: [
    "PERSONAL_LOAN",
    "STUDENT_LOAN",
    "AUTO_LOAN",
    "MORTGAGE",
    "MEDICAL",
    "OTHER_INSTALLMENT",
  ],
};

export async function mapAccountToDebt(
  accountId: string,
  debtId: string
): Promise<ActionResult> {
  const user = await requireBankDataUser();
  if (!user) return { error: NOT_ALLOWED };

  const account = await findOwnedAccount(user.id, accountId);
  if (!account) return { error: "Account not found." };

  const compatibleTypes = MAPPABLE_DEBT_TYPES[account.accountType];
  if (!compatibleTypes) {
    return { error: "Only credit-card and loan accounts can be mapped to a Debt." };
  }
  if (account.mappedDebtId) {
    return { error: "This account is already mapped. Unmap it first." };
  }

  const debt = await prisma.debt.findFirst({
    where: { id: debtId, profile: { userId: user.id } },
    include: { linkedAccount: { select: { name: true, institution: true } } },
  });
  if (!debt) return { error: "Debt not found." };
  if (debt.linkedAccount) {
    return {
      error: `"${debt.name}" is already mapped to ${debt.linkedAccount.institution} · ${debt.linkedAccount.name}. One feed per Debt.`,
    };
  }
  if (!compatibleTypes.includes(debt.debtType)) {
    return { error: "That Debt's type doesn't match this account." };
  }

  // Establish the mapping and hand the balance to the feed immediately.
  await prisma.$transaction([
    prisma.linkedAccount.update({
      where: { id: account.id },
      data: { mappedDebtId: debt.id },
    }),
    prisma.debt.update({
      where: { id: debt.id },
      data: { balance: Math.abs(Number(account.currentBalance)) },
    }),
  ]);

  revalidatePath(CONNECTIONS_PATH);
  return { success: true };
}

export async function createDebtFromAccount(
  accountId: string,
  input: { apr: number; minimumPayment: number }
): Promise<ActionResult> {
  const user = await requireBankDataUser();
  if (!user) return { error: NOT_ALLOWED };

  const account = await findOwnedAccount(user.id, accountId);
  if (!account) return { error: "Account not found." };
  if (!MAPPABLE_DEBT_TYPES[account.accountType]) {
    return { error: "Only credit-card and loan accounts can become Debts." };
  }
  if (account.mappedDebtId) {
    return { error: "This account is already mapped. Unmap it first." };
  }

  if (!Number.isFinite(input.apr) || input.apr < 0 || input.apr > 100) {
    return { error: "Enter the APR as a percentage between 0 and 100." };
  }
  if (!Number.isFinite(input.minimumPayment) || input.minimumPayment < 0) {
    return { error: "Enter the monthly minimum payment." };
  }

  // The Debt lives on the account's owner Profile, or the default profile
  // for household-shared accounts.
  const profile =
    (account.profileId
      ? await prisma.profile.findFirst({
          where: { id: account.profileId, userId: user.id },
          select: { id: true },
        })
      : null) ??
    (await prisma.profile.findFirst({
      where: { userId: user.id, isDefault: true },
      select: { id: true },
    })) ??
    (await prisma.profile.findFirst({
      where: { userId: user.id },
      select: { id: true },
    }));
  if (!profile) return { error: "No profile found for this household." };

  const debtType: DebtType =
    account.accountType === "CREDIT_CARD"
      ? "CREDIT_CARD"
      : inferLoanDebtType(account.name);

  await prisma.$transaction(async (tx) => {
    const debt = await tx.debt.create({
      data: {
        profileId: profile.id,
        name: account.name,
        balance: Math.abs(Number(account.currentBalance)),
        apr: input.apr,
        minimumPayment: input.minimumPayment,
        debtType,
      },
      select: { id: true },
    });
    await tx.linkedAccount.update({
      where: { id: account.id },
      data: { mappedDebtId: debt.id },
    });
  });

  revalidatePath(CONNECTIONS_PATH);
  return { success: true };
}

function inferLoanDebtType(accountName: string): DebtType {
  const n = accountName.toLowerCase();
  if (n.includes("mortgage")) return "MORTGAGE";
  if (n.includes("student")) return "STUDENT_LOAN";
  if (n.includes("auto") || n.includes("car")) return "AUTO_LOAN";
  return "PERSONAL_LOAN";
}

export async function unmapAccount(accountId: string): Promise<ActionResult> {
  const user = await requireBankDataUser();
  if (!user) return { error: NOT_ALLOWED };

  const account = await findOwnedAccount(user.id, accountId);
  if (!account) return { error: "Account not found." };
  if (!account.mappedDebtId) return { error: "This account isn't mapped." };

  // The Debt keeps its last synced balance and becomes editable again.
  await prisma.linkedAccount.update({
    where: { id: account.id },
    data: { mappedDebtId: null },
  });

  revalidatePath(CONNECTIONS_PATH);
  return { success: true };
}

/**
 * Debt-level sync captions for surfaces that already show Debt balances
 * (dashboard, forms). Deliberately available at AAL1: the feed-owned balance
 * itself lives on the Debt and appears in those views regardless, and the
 * Honesty Rule requires its freshness to be labeled wherever it renders. No
 * account identifiers, account balances, or transactions are exposed here —
 * those stay behind AAL2.
 */
export async function getMappedDebtCaptions(): Promise<
  { debtId: string; institution: string; balanceAsOf: string }[]
> {
  const { user } = await getBankDataAccess();
  if (!user) return [];

  const mapped = await prisma.linkedAccount.findMany({
    where: { connection: { userId: user.id }, mappedDebtId: { not: null } },
    select: { mappedDebtId: true, institution: true, balanceAsOf: true },
  });

  return mapped.map((m) => ({
    debtId: m.mappedDebtId as string,
    institution: m.institution,
    balanceAsOf: m.balanceAsOf.toISOString(),
  }));
}
