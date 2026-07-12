#!/usr/bin/env node
// Post-deploy production verification for big-time (see docs/runbooks/
// production-rollback.md). Exits nonzero on any failure and prints the exact
// rollback command.
//
// Usage: node scripts/verify-production.mjs [--wait-timeout <seconds>]

import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
  PRODUCTION_BASE_URL,
  PROBES,
  buildRollbackCommand,
  classifyDeploymentState,
  evaluateProbes,
  findDeploymentForCommit,
  findPreviousReadyDeployment,
  scanLogLines,
} from "./verify-production-core.mjs";

const execAsync = promisify(exec);

const POLL_INTERVAL_MS = 15_000;
const argTimeout = process.argv.indexOf("--wait-timeout");
const WAIT_TIMEOUT_MS =
  (argTimeout > -1 ? Number(process.argv[argTimeout + 1]) : 600) * 1000;

function log(message) {
  console.log(`[verify-production] ${message}`);
}

async function vercel(args) {
  // exec (not execFile) so the .cmd shim resolves on Windows
  const { stdout } = await execAsync(`vercel ${args.join(" ")}`, {
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

async function readProjectLink() {
  const raw = await readFile(new URL("../.vercel/project.json", import.meta.url), "utf8");
  return JSON.parse(raw);
}

async function fetchProductionDeployments(projectId) {
  const stdout = await vercel([
    "api",
    `"/v6/deployments?projectId=${projectId}&target=production&limit=10"`,
  ]);
  return JSON.parse(stdout).deployments ?? [];
}

async function localHeadSha() {
  try {
    const { stdout } = await execAsync("git rev-parse HEAD");
    return stdout.trim();
  } catch {
    return null; // not a git checkout — fall back to newest deployment
  }
}

async function waitForReady(projectId) {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  const headSha = await localHeadSha();
  if (headSha) log(`Verifying the deployment of commit ${headSha.slice(0, 7)}…`);
  for (;;) {
    const deployments = await fetchProductionDeployments(projectId);
    if (deployments.length === 0) throw new Error("No production deployments found");

    // Match on the commit so a not-yet-registered deployment can never let a
    // stale (previous) deployment pass verification.
    const current = findDeploymentForCommit(deployments, headSha);
    if (!current) {
      if (Date.now() > deadline) {
        return {
          current: deployments[0],
          deployments,
          failed: `no production deployment for commit ${headSha?.slice(0, 7)} appeared in time`,
        };
      }
      log(`No deployment for ${headSha?.slice(0, 7)} yet — waiting…`);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
    }

    const verdict = classifyDeploymentState(current.readyState);
    log(`Deployment ${current.uid} (${current.url}): ${current.readyState}`);
    if (verdict === "ready") return { current, deployments };
    if (verdict === "failed") {
      return { current, deployments, failed: `readyState ${current.readyState}` };
    }
    if (Date.now() > deadline) {
      return { current, deployments, failed: "timed out waiting for READY" };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function probeRoutes() {
  const results = [];
  for (const probe of PROBES) {
    const response = await fetch(`${PRODUCTION_BASE_URL}${probe.path}`, {
      redirect: "manual",
      headers: { "user-agent": "big-time-verify-production" },
    });
    const result = {
      path: probe.path,
      status: response.status,
      location: response.headers.get("location") ?? undefined,
    };
    log(`Probe ${result.path} -> ${result.status}${result.location ? ` (${result.location})` : ""}`);
    results.push(result);
  }
  return results;
}

async function scanRuntimeLogs() {
  // Probes above generate fresh traffic, so a short window is enough to
  // catch a deployment that errors on every request.
  const errors = [];
  for (const level of ["error", "fatal"]) {
    const stdout = await vercel([
      "logs",
      "--environment",
      "production",
      "--level",
      level,
      "--since",
      "15m",
      "--json",
      "--no-branch",
    ]);
    errors.push(...scanLogLines(stdout));
  }
  return errors;
}

async function main() {
  const { projectId } = await readProjectLink();
  log(`Waiting for the latest production deployment of ${projectId}…`);

  const { current, deployments, failed } = await waitForReady(projectId);
  const previous = findPreviousReadyDeployment(deployments);
  const failures = [];

  if (failed) {
    failures.push(`Deployment ${current.uid} failed verification: ${failed}`);
  } else {
    const probeResults = await probeRoutes();
    const probeVerdict = evaluateProbes(probeResults);
    failures.push(...probeVerdict.failures);

    log("Scanning production runtime logs for error/fatal entries…");
    const logErrors = await scanRuntimeLogs();
    if (logErrors.length > 0) {
      failures.push(
        `${logErrors.length} error/fatal runtime log entr${logErrors.length === 1 ? "y" : "ies"} in the last 15m`
      );
      for (const entry of logErrors.slice(0, 5)) {
        log(`  runtime ${entry.level}: ${JSON.stringify(entry.message ?? entry).slice(0, 300)}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error("\n[verify-production] FAILED:");
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error("\nRoll back production with:");
    console.error(`  ${buildRollbackCommand(previous)}`);
    console.error("\nRunbook: docs/runbooks/production-rollback.md");
    process.exit(1);
  }

  log(`OK — deployment ${current.uid} verified (probes + runtime logs clean).`);
}

main().catch((error) => {
  console.error(`[verify-production] Unexpected error: ${error.message}`);
  console.error("Runbook: docs/runbooks/production-rollback.md");
  process.exit(1);
});
