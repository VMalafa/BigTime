"use client";

import { useActionState } from "react";

import { linkConnection, type ActionResult } from "@/app/actions/aggregator";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

// Setup-token paste flow (ADR-0001): the household authenticates at their
// bank via SimpleFIN Bridge, then brings back a one-time setup token. The
// app never sees a bank credential.

export function LinkTokenForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => linkConnection(null, formData),
    null
  );

  return (
    <Card padding="lg">
      <h2 className="font-serif text-xl text-text-primary mb-2">
        Link your accounts
      </h2>
      <div className="text-text-secondary text-sm font-sans space-y-2 mb-4">
        <p>
          Rich Life reads balances through{" "}
          <a
            href="https://bridge.simplefin.org"
            target="_blank"
            rel="noreferrer"
            className="text-accent-gold hover:underline"
          >
            SimpleFIN Bridge
          </a>{" "}
          — read-only by design. Your bank password never touches this app.
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Sign in at SimpleFIN Bridge and connect your institutions there.</li>
          <li>
            Create a new app connection and copy the <strong>setup token</strong>{" "}
            it gives you.
          </li>
          <li>Paste the token below. Tokens are single-use and never stored.</li>
        </ol>
      </div>

      {state?.error && (
        <p className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {state.error}{" "}
          <a
            href="https://bridge.simplefin.org"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Open SimpleFIN Bridge
          </a>
        </p>
      )}
      {state?.success && (
        <p className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg text-sm mb-4">
          Connected! Your accounts are listed below.
        </p>
      )}

      <form action={formAction} className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            name="setupToken"
            label="SimpleFIN setup token"
            placeholder="Paste your setup token"
            autoComplete="off"
            required
          />
        </div>
        <div className="sm:pt-7">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Claiming token..." : "Link accounts"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
