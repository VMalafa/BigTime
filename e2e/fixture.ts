// Shared helpers for the signed-in E2E fixture household. The fixture is an
// isolated synthetic household (all row ids prefixed `e2e-spending-`) seeded
// by upserts only — it never touches real household data.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const E2E_SPENDING_EMAIL = "e2e-spending@example.com";

/**
 * Minimal .env loader (values are set into process.env, never logged).
 * `next dev` loads .env itself; Playwright's own processes do not.
 */
export function loadDotEnv(): void {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^"(.*)"$/, "$1");
  }
}

/**
 * Deterministic fixture password derived from the service-role key: stable
 * across runs on this machine, never committed, never printed.
 */
export function e2eSpendingPassword(): string {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — run loadDotEnv() first (needs .env)."
    );
  }
  return (
    "E2e!" +
    createHash("sha256")
      .update(`${serviceKey}:e2e-spending-fixture`)
      .digest("base64url")
      .slice(0, 24)
  );
}
