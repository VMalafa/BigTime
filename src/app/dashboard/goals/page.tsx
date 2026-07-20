"use client";

// Goals v1 (#86, ratified in #80): one dream per savings account. Linked
// Goals track the feed balance — the app never edits the dream's number
// by hand once the feed owns it. Exactly one Spotlight; its slice rides
// the Earmark engine, so Safe-to-Spend already subtracts it.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  createGoal,
  listGoals,
  setSpotlight,
  updateGoal,
  type GoalsTruth,
} from "@/app/actions/goals";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function GoalsPage() {
  const [truth, setTruth] = useState<GoalsTruth | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [target, setTarget] = useState("");
  const [accountId, setAccountId] = useState("");
  const [creating, setCreating] = useState(false);

  // Spotlight switch confirm (≤2 taps: Make Spotlight → confirm).
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [sliceDrafts, setSliceDrafts] = useState<Map<string, string>>(
    new Map()
  );

  const refresh = () => listGoals().then(setTruth);
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    const result = await createGoal({
      name,
      emoji: emoji || undefined,
      targetCents: Math.round(Number(target) * 100),
      linkedAccountId: accountId || undefined,
    });
    setCreating(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setName("");
    setEmoji("");
    setTarget("");
    setAccountId("");
    await refresh();
  }

  async function handleSpotlight(id: string) {
    setConfirmingId(null);
    setError(null);
    const previous = truth;
    // Optimistic: the badge moves at once; rollback on refusal.
    setTruth((current) =>
      current
        ? {
            ...current,
            goals: current.goals.map((g) => ({
              ...g,
              isSpotlight: g.id === id,
            })),
          }
        : current
    );
    const result = await setSpotlight({ id });
    if (result.error) {
      setTruth(previous);
      setError(result.error);
      return;
    }
    await refresh();
  }

  async function handleSlice(id: string) {
    const draft = sliceDrafts.get(id);
    if (draft === undefined) return;
    setError(null);
    const result = await updateGoal({
      id,
      sliceCents: Math.round(Number(draft) * 100),
    });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    await refresh();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.h1
        className="font-serif text-3xl text-text-primary mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Goals
      </motion.h1>
      <p className="text-text-secondary font-sans text-sm mb-8">
        One dream per savings account — when linked, the account&apos;s
        balance IS the progress. One Spotlight at a time; its slice is
        already subtracted from Safe-to-Spend.
      </p>

      {truth?.goals.map((goal) => (
        <Card key={goal.id} padding="lg" className="mb-4" data-goal={goal.name}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
            <h3 className="min-w-0 font-serif text-lg text-text-primary">
              {goal.emoji ? `${goal.emoji} ` : ""}
              {goal.name}
            </h3>
            {goal.isSpotlight ? (
              <span className="rounded-full border border-accent-gold bg-accent-gold/10 px-2 py-0.5 text-xs font-sans text-accent-gold-deep">
                Spotlight
              </span>
            ) : confirmingId === goal.id ? (
              <button
                type="button"
                onClick={() => handleSpotlight(goal.id)}
                className="min-h-11 rounded-full bg-text-primary px-3.5 py-1 text-xs font-sans text-white"
              >
                Confirm — the slice moves with it
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingId(goal.id)}
                className="min-h-11 rounded-full border border-bg-secondary px-3.5 py-1 text-xs font-sans text-text-secondary hover:border-accent-gold transition-colors"
              >
                Make Spotlight
              </button>
            )}
          </div>

          <div className="mt-3">
            <div className="h-2 rounded-full bg-bg-secondary overflow-hidden">
              <div
                className="h-full bg-accent-gold"
                style={{ width: `${goal.percentFunded}%` }}
              />
            </div>
            <p className="mt-1 text-sm font-sans text-text-secondary">
              {dollars(goal.progressCents)} of {dollars(goal.targetCents)} ·{" "}
              {goal.percentFunded}% funded
              {goal.linkedAccountName
                ? ` · tracked by ${goal.linkedAccountName}`
                : " · manual until linked"}
            </p>
          </div>

          {goal.isSpotlight && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label
                htmlFor={`slice-${goal.id}`}
                className="text-xs font-sans text-text-secondary"
              >
                Slice per Pay Period ($)
              </label>
              <input
                id={`slice-${goal.id}`}
                type="number"
                min="0"
                className="w-24 rounded-lg border border-bg-secondary px-2 py-1 text-sm font-sans"
                value={
                  sliceDrafts.get(goal.id) ?? String(goal.sliceCents / 100)
                }
                onChange={(e) =>
                  setSliceDrafts((current) =>
                    new Map(current).set(goal.id, e.target.value)
                  )
                }
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleSlice(goal.id)}
              >
                Set slice
              </Button>
            </div>
          )}
        </Card>
      ))}

      <Card padding="lg" className="mt-6">
        <h3 className="font-serif text-lg text-text-primary mb-3">
          Name the next dream
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Goal name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hawaii"
          />
          <Input
            label="Emoji (optional)"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🌺"
          />
          <Input
            label="Target ($)"
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="10000"
          />
          <div>
            <label
              htmlFor="goal-account"
              className="block text-sm font-sans text-text-secondary mb-1"
            >
              Savings account (optional)
            </label>
            <select
              id="goal-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-bg-secondary px-3 py-2 text-sm font-sans bg-white"
            >
              <option value="">Not linked yet</option>
              {truth?.linkableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({dollars(account.balanceCents)})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={handleCreate} disabled={creating || !name || !target}>
            {creating ? "Creating…" : "Create Goal"}
          </Button>
        </div>
      </Card>

      {error && (
        <p role="alert" className="mt-4 text-sm font-sans text-error">
          {error}
        </p>
      )}
    </div>
  );
}
