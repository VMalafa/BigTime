"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

// TOTP enrollment (ADR-0002): required once before the household's first
// aggregator connection. Enroll → scan QR → verify a code; verification also
// upgrades this session to AAL2.

interface EnrollmentState {
  factorId: string;
  qrCode: string; // SVG data URI from Supabase
  secret: string; // manual-entry fallback
}

export function MfaEnrollment() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startEnrollment = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    // Clear out abandoned unverified factors so re-visits don't pile them up.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const factor of factors?.all ?? []) {
      if (factor.factor_type === "totp" && factor.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
    });
    setBusy(false);
    if (enrollError || !data) {
      setError(enrollError?.message ?? "Couldn't start enrollment. Please try again.");
      return;
    }
    setEnrollment({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  };

  const verify = async () => {
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError("That code didn't match. Check your authenticator app and try again.");
      return;
    }
    // Session is now AAL2 — re-render the server component tree.
    router.refresh();
  };

  return (
    <Card padding="lg">
      <h2 className="font-serif text-xl text-text-primary mb-2">
        Protect your bank data with two-factor
      </h2>
      <p className="text-text-secondary text-sm font-sans mb-4">
        Before linking a bank feed, add an authenticator app (like 1Password,
        Google Authenticator, or Authy) to your household login. You&apos;ll
        only be asked for a code when opening bank-data pages.
      </p>

      {error && (
        <p className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </p>
      )}

      {!enrollment ? (
        <Button variant="primary" onClick={startEnrollment} disabled={busy}>
          {busy ? "Setting up..." : "Set up authenticator"}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR as an inline SVG data URI */}
            <img
              src={enrollment.qrCode}
              alt="QR code for your authenticator app"
              width={160}
              height={160}
              className="rounded-lg border border-bg-secondary bg-white"
            />
            <div className="text-sm text-text-secondary font-sans space-y-2">
              <p>1. Scan this QR code with your authenticator app.</p>
              <p>
                Can&apos;t scan? Enter this key manually:{" "}
                <code className="text-xs break-all bg-bg-secondary px-1.5 py-0.5 rounded">
                  {enrollment.secret}
                </code>
              </p>
              <p>2. Enter the 6-digit code the app shows.</p>
            </div>
          </div>
          <div className="flex items-end gap-3 max-w-xs">
            <Input
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button
              variant="primary"
              onClick={verify}
              disabled={busy || code.trim().length < 6}
            >
              {busy ? "Verifying..." : "Verify"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
