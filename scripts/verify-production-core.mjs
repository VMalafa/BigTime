// Pure decision logic for post-deploy production verification.
// The CLI entry point (verify-production.mjs) shells out to the Vercel CLI
// and fetch(); everything that can be unit-tested lives here.

/** Canonical production domain probed after every deploy. */
export const PRODUCTION_BASE_URL = "https://big-time-inky.vercel.app";

/**
 * Routes that must answer correctly for a production deployment to count as
 * verified. Unauthenticated visitors are redirected (307) away from
 * authenticated pages by the middleware.
 */
export const PROBES = [
  { path: "/", expectStatus: 200 },
  { path: "/auth/login", expectStatus: 200 },
  { path: "/dashboard", expectStatus: 307, expectLocationIncludes: "/auth/login" },
  { path: "/settings/connections", expectStatus: 307 },
];

/**
 * Maps a Vercel readyState to what the verifier should do next.
 * READY -> proceed; terminal failures -> fail; anything else -> keep polling.
 */
export function classifyDeploymentState(readyState) {
  if (readyState === "READY") return "ready";
  if (["ERROR", "CANCELED", "DELETED"].includes(readyState)) return "failed";
  return "pending";
}

/**
 * Given the deployments list (newest first) from
 * GET /v6/deployments?target=production, returns the deployment to roll back
 * to: the newest READY deployment that is not the current one.
 */
export function findPreviousReadyDeployment(deployments) {
  if (!Array.isArray(deployments) || deployments.length < 2) return null;
  return deployments.slice(1).find((d) => d.readyState === "READY") ?? null;
}

/**
 * Evaluates probe outcomes against PROBES expectations.
 * `results` items: { path, status, location } (location may be undefined).
 */
export function evaluateProbes(results, probes = PROBES) {
  const failures = [];
  for (const probe of probes) {
    const result = results.find((r) => r.path === probe.path);
    if (!result) {
      failures.push(`${probe.path}: no probe result`);
      continue;
    }
    if (result.status !== probe.expectStatus) {
      failures.push(
        `${probe.path}: expected ${probe.expectStatus}, got ${result.status}`
      );
      continue;
    }
    if (
      probe.expectLocationIncludes &&
      !(result.location ?? "").includes(probe.expectLocationIncludes)
    ) {
      failures.push(
        `${probe.path}: expected redirect to include "${probe.expectLocationIncludes}", got "${result.location ?? ""}"`
      );
    }
  }
  return { pass: failures.length === 0, failures };
}

/**
 * Parses `vercel logs --json` output (JSON Lines) and returns entries at
 * error/fatal level. Non-JSON lines are ignored — the CLI mixes in banner
 * text on stderr, and a malformed line must never crash verification.
 */
export function scanLogLines(rawOutput) {
  const errors = [];
  for (const line of rawOutput.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    let entry;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (["error", "fatal"].includes(entry.level)) {
      errors.push(entry);
    }
  }
  return errors;
}

/** The exact command to roll production back to the previous Ready deploy. */
export function buildRollbackCommand(previousDeployment) {
  if (!previousDeployment) {
    return "vercel rollback --scope vmalafas-projects";
  }
  const target = previousDeployment.uid ?? previousDeployment.url;
  return `vercel rollback ${target} --scope vmalafas-projects --yes`;
}
