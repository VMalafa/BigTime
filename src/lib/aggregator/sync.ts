import { prisma } from "@/lib/prisma";
import { applyDeterministicCategorization } from "../categorization/apply.ts";
import { AggregatorError } from "./provider.ts";
import { openSecret } from "./secret-box.ts";
import { getAggregatorProvider } from "./simplefin.ts";

// One sync = fetch snapshot → upsert accounts → upsert transactions →
// overwrite mapped Debt balances → stamp lastSyncAt. Idempotent by
// construction (upserts keyed on provider identities), so re-running a sync
// is always safe.

/** Overlap window re-fetched before lastSyncAt so pending → posted settlements are caught. */
const RESYNC_OVERLAP_MS = 7 * 24 * 60 * 60 * 1000;
/** History fetched on a connection's first sync. */
const INITIAL_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

export interface SyncResult {
  connectionId: string;
  ok: boolean;
  accounts: number;
  transactions: number;
  error?: string;
}

export async function syncConnection(connectionId: string): Promise<SyncResult> {
  const connection = await prisma.aggregatorConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection || connection.status === "REVOKED") {
    return {
      connectionId,
      ok: false,
      accounts: 0,
      transactions: 0,
      error: "Connection not found or revoked.",
    };
  }

  try {
    const provider = getAggregatorProvider();
    const accessSecret = openSecret(connection.encryptedAccessSecret);
    const since = connection.lastSyncAt
      ? new Date(connection.lastSyncAt.getTime() - RESYNC_OVERLAP_MS)
      : new Date(Date.now() - INITIAL_LOOKBACK_MS);

    const snapshot = await provider.fetchAccounts(accessSecret, since);

    const accountIdByExternalId = new Map<string, string>();
    for (const account of snapshot.accounts) {
      const upserted = await prisma.linkedAccount.upsert({
        where: {
          connectionId_externalId: {
            connectionId: connection.id,
            externalId: account.externalId,
          },
        },
        update: {
          name: account.name,
          institution: account.institution,
          maskedNumber: account.maskedNumber,
          currentBalance: account.balance,
          balanceAsOf: account.balanceAsOf,
          currency: account.currency,
          // accountType is deliberately not updated: it was inferred at
          // discovery and may gate an existing Debt mapping.
        },
        create: {
          connectionId: connection.id,
          externalId: account.externalId,
          name: account.name,
          institution: account.institution,
          accountType: account.accountType,
          maskedNumber: account.maskedNumber,
          currentBalance: account.balance,
          balanceAsOf: account.balanceAsOf,
          currency: account.currency,
        },
        select: { id: true, mappedDebtId: true },
      });
      accountIdByExternalId.set(account.externalId, upserted.id);

      // The feed owns mapped Debt balances (Mapping, per CONTEXT.md): each
      // sync overwrites the balance; APR/minimum/limit stay manual.
      if (upserted.mappedDebtId) {
        await prisma.debt.update({
          where: { id: upserted.mappedDebtId },
          data: { balance: Math.abs(account.balance) },
        });
      }
    }

    let transactionCount = 0;
    for (const transaction of snapshot.transactions) {
      const linkedAccountId = accountIdByExternalId.get(
        transaction.accountExternalId
      );
      if (!linkedAccountId) continue;
      // Upsert on provider identity: a pending transaction that later posts
      // with the same id is updated in place, never duplicated.
      await prisma.feedTransaction.upsert({
        where: {
          linkedAccountId_externalId: {
            linkedAccountId,
            externalId: transaction.externalId,
          },
        },
        update: {
          postedAt: transaction.postedAt,
          amount: transaction.amount,
          description: transaction.description,
          pending: transaction.pending,
        },
        create: {
          linkedAccountId,
          externalId: transaction.externalId,
          postedAt: transaction.postedAt,
          amount: transaction.amount,
          description: transaction.description,
          pending: transaction.pending,
        },
      });
      transactionCount++;
    }

    // Deterministic Categorization layers only (ADR-0003): Transfer pairing,
    // mapped-Debt accounts, fixed-cost line items, the household rule table.
    // No AI or network calls — unmatched transactions stay UNCATEGORIZED.
    await applyDeterministicCategorization(prisma, connection.userId);

    await prisma.aggregatorConnection.update({
      where: { id: connection.id },
      data: {
        status: "ACTIVE",
        lastSyncAt: new Date(),
        // Provider warnings (e.g. one institution needing attention) are kept
        // visible without failing the sync — labeled, never hidden.
        lastSyncError: snapshot.warnings.length
          ? snapshot.warnings.join(" ")
          : null,
      },
    });

    return {
      connectionId: connection.id,
      ok: true,
      accounts: snapshot.accounts.length,
      transactions: transactionCount,
    };
  } catch (error) {
    const message =
      error instanceof AggregatorError
        ? error.message
        : "Something went wrong while syncing. Previously synced data is unaffected.";
    await prisma.aggregatorConnection.update({
      where: { id: connection.id },
      data: { status: "ERROR", lastSyncError: message },
    });
    return {
      connectionId: connection.id,
      ok: false,
      accounts: 0,
      transactions: 0,
      error: message,
    };
  }
}

/**
 * Sync every non-revoked connection (ERROR connections retry too — feeds
 * often recover). One connection's failure never blocks the others.
 */
export async function syncAllConnections(): Promise<SyncResult[]> {
  const connections = await prisma.aggregatorConnection.findMany({
    where: { status: { not: "REVOKED" } },
    select: { id: true },
  });

  const results: SyncResult[] = [];
  for (const { id } of connections) {
    // syncConnection catches its own errors; belt-and-braces here so a bug
    // in error handling still can't halt the batch.
    results.push(
      await syncConnection(id).catch((error: unknown) => ({
        connectionId: id,
        ok: false,
        accounts: 0,
        transactions: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      }))
    );
  }
  return results;
}

/** Sync all of one household's non-revoked connections. */
export async function syncConnectionsForUser(userId: string): Promise<SyncResult[]> {
  const connections = await prisma.aggregatorConnection.findMany({
    where: { userId, status: { not: "REVOKED" } },
    select: { id: true },
  });
  const results: SyncResult[] = [];
  for (const { id } of connections) {
    results.push(await syncConnection(id));
  }
  return results;
}
