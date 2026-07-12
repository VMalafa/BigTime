"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { StepWrapper } from "@/components/flow/StepWrapper";
import { Button } from "@/components/ui/Button";
import { useFlowStore } from "@/lib/store/flow-store";
import { useAuth } from "@/lib/hooks/useAuth";

// The onboarding fork after the money-type step: link accounts and let the
// feed draft the plan (Proposals to ratify on the next steps), or type it
// in — the manual path, unchanged.

export default function LinkAccountsForkPage() {
  const router = useRouter();
  const setCurrentStep = useFlowStore((s) => s.setCurrentStep);
  const { isAuthenticated } = useAuth();

  const linkHref = isAuthenticated
    ? "/settings/connections"
    : "/auth/signup?redirectTo=/settings/connections";

  function handleTypeItIn() {
    // Identical to the pre-fork money-type "next": the manual path is
    // unchanged.
    setCurrentStep(2);
    router.push("/flow/debts");
  }

  return (
    <StepWrapper
      title="How do you want to fill in the numbers?"
      subtitle="Either way, nothing enters your plan until you confirm it."
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-white border border-accent-gold/50 p-6">
          <h2 className="font-serif text-xl text-text-primary mb-1">
            Link your accounts and we&apos;ll fill in the rest
          </h2>
          <p className="text-sm text-text-secondary font-sans mb-4">
            Connect your bank read-only (we never see your credentials). The
            feed drafts your fixed costs and debts as Proposals — you confirm
            what&apos;s right, fix what isn&apos;t, and the boring typing
            disappears.
          </p>
          <Link href={linkHref}>
            <Button variant="primary" size="md">
              Link accounts
            </Button>
          </Link>
          <p className="text-xs text-text-secondary font-sans mt-3">
            You&apos;ll create a household login and connect through SimpleFIN,
            then come back here — the next steps will be waiting with
            Proposals to confirm.
          </p>
        </div>

        <div className="rounded-lg bg-white border border-bg-secondary p-6">
          <h2 className="font-serif text-xl text-text-primary mb-1">
            I&apos;ll type it in
          </h2>
          <p className="text-sm text-text-secondary font-sans mb-4">
            Enter your debts, income, and bills by hand. You can always link
            accounts later from Settings.
          </p>
          <Button variant="secondary" size="md" onClick={handleTypeItIn}>
            Continue typing it in
          </Button>
        </div>
      </div>
    </StepWrapper>
  );
}
