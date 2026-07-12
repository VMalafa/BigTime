import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

// Bank-data access guard (ADR-0002): every route/server action that reads or
// mutates aggregator connections, linked accounts, or feed transactions must
// hold an MFA-verified session (AAL2). Server actions are reachable by direct
// POST, so this is enforced here — server-side — not just in the UI.

export type MfaState =
  | "unauthenticated"
  | "needs-enrollment" // no verified TOTP factor yet
  | "needs-challenge" // factor enrolled, session is still password-only
  | "aal2";

export interface BankDataAccess {
  user: User | null;
  mfaState: MfaState;
}

export async function getBankDataAccess(): Promise<BankDataAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, mfaState: "unauthenticated" };

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return { user, mfaState: "needs-enrollment" };

  if (data.currentLevel === "aal2") return { user, mfaState: "aal2" };
  // nextLevel aal2 with a lower current level means a verified factor exists
  // but this session hasn't passed a TOTP challenge yet.
  if (data.nextLevel === "aal2") return { user, mfaState: "needs-challenge" };
  return { user, mfaState: "needs-enrollment" };
}

/**
 * Guard for bank-data server actions: returns the user only for AAL2
 * sessions, null otherwise. Callers must treat null as a refusal.
 */
export async function requireBankDataUser(): Promise<User | null> {
  const { user, mfaState } = await getBankDataAccess();
  return mfaState === "aal2" ? user : null;
}
