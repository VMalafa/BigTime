"use client";

import { useState, useTransition } from "react";

import {
  createDebtFromAccount,
  deleteConnection,
  mapAccountToDebt,
  refreshNow,
  setAccountOwner,
  unmapAccount,
  type ActionResult,
} from "@/app/actions/aggregator";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatAsOf, formatCurrencyExact } from "@/lib/utils/format";
import type {
  AccountView,
  ConnectionView,
  DebtCandidate,
  ProfileOption,
} from "./types";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  CREDIT_CARD: "Credit Card",
  LOAN: "Loan",
  INVESTMENT: "Investment",
  OTHER: "Other",
};

// Mirrors the server-side compatibility rule (the server re-validates).
const COMPATIBLE_DEBT_TYPES: Record<string, string[]> = {
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

interface ConnectionCardProps {
  connection: ConnectionView;
  profiles: ProfileOption[];
  debtCandidates: DebtCandidate[];
}

export function ConnectionCard({
  connection,
  profiles,
  debtCandidates,
}: ConnectionCardProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const run = (action: () => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  };

  const institutions = [
    ...new Set(connection.accounts.map((a) => a.institution)),
  ].join(", ");

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="font-serif text-lg text-text-primary">
            {institutions || "SimpleFIN connection"}
          </h3>
          <p className="text-text-secondary text-xs font-sans">
            {connection.lastSyncAt
              ? `Last synced ${formatAsOf(connection.lastSyncAt)}`
              : "Not synced yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => run(refreshNow)}
          >
            Refresh now
          </Button>
          {confirmingDelete ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-error"
                disabled={pending}
                onClick={() => run(() => deleteConnection(connection.id))}
              >
                Really delete?
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
              >
                Keep
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-error"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Connection health, in plain language — never blocks the rest of the app. */}
      {connection.status === "ERROR" && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-sans mt-3">
          {institutions || "This connection"} hasn&apos;t reported since{" "}
          {connection.lastSyncAt
            ? formatAsOf(connection.lastSyncAt).replace("as of ", "")
            : "it was linked"}
          {connection.lastSyncError ? ` — ${connection.lastSyncError}` : "."}{" "}
          Try Refresh, or re-link with a fresh setup token from{" "}
          <a
            href="https://bridge.simplefin.org"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            SimpleFIN Bridge
          </a>
          . Your previously synced numbers are still shown with their dates.
        </div>
      )}
      {connection.status === "ACTIVE" && connection.lastSyncError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm font-sans mt-3">
          {connection.lastSyncError}
        </div>
      )}
      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-sans mt-3"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="divide-y divide-bg-secondary mt-4">
        {connection.accounts.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            profiles={profiles}
            debtCandidates={debtCandidates}
            pending={pending}
            run={run}
          />
        ))}
        {connection.accounts.length === 0 && (
          <p className="text-text-secondary text-sm font-sans py-3">
            No accounts discovered yet — try Refresh, or check the connection
            at SimpleFIN Bridge.
          </p>
        )}
      </div>
    </Card>
  );
}

interface AccountRowProps {
  account: AccountView;
  profiles: ProfileOption[];
  debtCandidates: DebtCandidate[];
  pending: boolean;
  run: (action: () => Promise<ActionResult>) => void;
}

function AccountRow({
  account,
  profiles,
  debtCandidates,
  pending,
  run,
}: AccountRowProps) {
  const compatible = debtCandidates.filter((d) =>
    (COMPATIBLE_DEBT_TYPES[account.accountType] ?? []).includes(d.debtType)
  );

  return (
    <div className="py-4 first:pt-2 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-sans text-sm font-medium text-text-primary">
            {account.name}
          </span>{" "}
          <span className="text-text-secondary text-xs font-sans">
            {ACCOUNT_TYPE_LABELS[account.accountType] ?? account.accountType}
            {account.maskedNumber ? ` · ${account.maskedNumber}` : ""}
          </span>
        </div>
        <div className="text-right">
          <span className="font-serif text-lg text-text-primary">
            {formatCurrencyExact(account.currentBalance)}
          </span>
          <span className="block text-text-secondary text-xs font-sans">
            {formatAsOf(account.balanceAsOf)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
        <label className="flex items-center gap-2 text-xs font-sans text-text-secondary">
          Owner
          <select
            className="border border-bg-secondary rounded-lg px-2 py-1 text-sm text-text-primary bg-white"
            value={account.profileId ?? ""}
            disabled={pending}
            onChange={(e) =>
              run(() => setAccountOwner(account.id, e.target.value || null))
            }
          >
            <option value="">Household (shared)</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {account.mappable && (
          <MappingControls
            account={account}
            compatibleDebts={compatible}
            pending={pending}
            run={run}
          />
        )}
      </div>
    </div>
  );
}

interface MappingControlsProps {
  account: AccountView;
  compatibleDebts: DebtCandidate[];
  pending: boolean;
  run: (action: () => Promise<ActionResult>) => void;
}

function MappingControls({
  account,
  compatibleDebts,
  pending,
  run,
}: MappingControlsProps) {
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [creating, setCreating] = useState(false);
  const [apr, setApr] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");

  if (account.mappedDebt) {
    return (
      <span className="flex items-center gap-2 text-xs font-sans text-text-secondary">
        Keeps <strong className="text-text-primary">{account.mappedDebt.name}</strong>{" "}
        up to date
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(() => unmapAccount(account.id))}
        >
          Unmap
        </Button>
      </span>
    );
  }

  if (creating) {
    return (
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            createDebtFromAccount(account.id, {
              apr: Number(apr),
              minimumPayment: Number(minimumPayment),
            })
          );
        }}
      >
        <div className="w-24">
          <Input
            label="APR %"
            type="number"
            step="0.001"
            min="0"
            max="100"
            value={apr}
            onChange={(e) => setApr(e.target.value)}
            required
          />
        </div>
        <div className="w-32">
          <Input
            label="Min. payment"
            type="number"
            step="0.01"
            min="0"
            value={minimumPayment}
            onChange={(e) => setMinimumPayment(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          Create Debt
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCreating(false)}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-xs font-sans text-text-secondary">
      {compatibleDebts.length > 0 && (
        <>
          <select
            className="border border-bg-secondary rounded-lg px-2 py-1 text-sm text-text-primary bg-white"
            value={selectedDebtId}
            disabled={pending}
            onChange={(e) => setSelectedDebtId(e.target.value)}
          >
            <option value="">Map to existing Debt…</option>
            {compatibleDebts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {formatCurrencyExact(d.balance)}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending || !selectedDebtId}
            onClick={() => run(() => mapAccountToDebt(account.id, selectedDebtId))}
          >
            Map
          </Button>
          <span>or</span>
        </>
      )}
      <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
        Create Debt from this account
      </Button>
    </span>
  );
}
