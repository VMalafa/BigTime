import Link from "next/link";
import { redirect } from "next/navigation";

import { ConnectionCard } from "@/components/connections/ConnectionCard";
import { LinkTokenForm } from "@/components/connections/LinkTokenForm";
import { MfaChallenge } from "@/components/connections/MfaChallenge";
import { MfaEnrollment } from "@/components/connections/MfaEnrollment";
import type {
  ConnectionView,
  DebtCandidate,
  ProfileOption,
} from "@/components/connections/types";
import { getBankDataAccess } from "@/lib/aggregator/access";
import { prisma } from "@/lib/prisma";

// Bank connections live behind AAL2 (ADR-0002): this server component is the
// only place linked-account data is fetched, and it fetches nothing until the
// session is MFA-verified. Client components receive transient props only —
// bank data never reaches localStorage or any persisted client store.

const MAPPABLE_TYPES = new Set(["CREDIT_CARD", "LOAN"]);

export default async function ConnectionsPage() {
  const { user, mfaState } = await getBankDataAccess();
  if (!user) redirect("/auth/login");

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <Link
            href="/dashboard/settings"
            className="text-text-secondary text-sm font-sans hover:text-text-primary"
          >
            ← Settings
          </Link>
          <h1 className="font-serif text-3xl text-text-primary mt-2">
            Linked Accounts
          </h1>
          <p className="text-text-secondary font-sans text-sm mt-1">
            Read-only bank feeds, refreshed daily. Balances always show when
            they were last reported.
          </p>
        </div>

        {mfaState === "needs-enrollment" && <MfaEnrollment />}
        {mfaState === "needs-challenge" && <MfaChallenge />}
        {mfaState === "aal2" && <ConnectionsContent userId={user.id} />}
      </div>
    </div>
  );
}

async function ConnectionsContent({ userId }: { userId: string }) {
  const [connections, profiles, debts] = await Promise.all([
    prisma.aggregatorConnection.findMany({
      where: { userId, status: { not: "REVOKED" } },
      orderBy: { createdAt: "asc" },
      include: {
        linkedAccounts: {
          orderBy: [{ institution: "asc" }, { name: "asc" }],
          include: { mappedDebt: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.profile.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.debt.findMany({
      where: { profile: { userId }, linkedAccount: null },
      select: { id: true, name: true, balance: true, debtType: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const connectionViews: ConnectionView[] = connections.map((connection) => ({
    id: connection.id,
    status: connection.status,
    lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
    lastSyncError: connection.lastSyncError,
    accounts: connection.linkedAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      institution: account.institution,
      accountType: account.accountType,
      maskedNumber: account.maskedNumber,
      currentBalance: Number(account.currentBalance),
      balanceAsOf: account.balanceAsOf.toISOString(),
      currency: account.currency,
      profileId: account.profileId,
      mappedDebt: account.mappedDebt
        ? { id: account.mappedDebt.id, name: account.mappedDebt.name }
        : null,
      mappable: MAPPABLE_TYPES.has(account.accountType),
    })),
  }));

  const profileOptions: ProfileOption[] = profiles;
  const debtCandidates: DebtCandidate[] = debts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: Number(d.balance),
    debtType: d.debtType,
  }));

  return (
    <>
      <LinkTokenForm />
      {connectionViews.map((connection) => (
        <ConnectionCard
          key={connection.id}
          connection={connection}
          profiles={profileOptions}
          debtCandidates={debtCandidates}
        />
      ))}
    </>
  );
}
