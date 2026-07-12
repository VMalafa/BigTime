"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

// TOTP challenge (ADR-0002): a password-only session must verify a code
// before any bank data is served. Verification upgrades the session to AAL2;
// the server re-checks the level on every bank-data read.

export function MfaChallenge() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { data: factors, error: listError } =
      await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp?.[0];
    if (listError || !totpFactor) {
      setBusy(false);
      setError("Couldn't find your authenticator. Try signing out and back in.");
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: totpFactor.id,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError("That code didn't match. Check your authenticator app and try again.");
      return;
    }
    router.refresh();
  };

  return (
    <Card padding="lg">
      <h2 className="font-serif text-xl text-text-primary mb-2">
        Enter your two-factor code
      </h2>
      <p className="text-text-secondary text-sm font-sans mb-4">
        Bank data stays locked until you confirm it&apos;s you. Open your
        authenticator app and enter the current 6-digit code.
      </p>

      {error && (
        <p className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </p>
      )}

      <form
        className="flex items-end gap-3 max-w-xs"
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <Input
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={busy || code.trim().length < 6}
        >
          {busy ? "Verifying..." : "Unlock"}
        </Button>
      </form>
    </Card>
  );
}
