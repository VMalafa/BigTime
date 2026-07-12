import { describe, expect, it } from "vitest";
import {
  PROBES,
  buildRollbackCommand,
  classifyDeploymentState,
  evaluateProbes,
  findDeploymentForCommit,
  findPreviousReadyDeployment,
  scanLogLines,
} from "./verify-production-core.mjs";

describe("classifyDeploymentState", () => {
  it("treats READY as ready", () => {
    expect(classifyDeploymentState("READY")).toBe("ready");
  });

  it("treats terminal states as failed", () => {
    expect(classifyDeploymentState("ERROR")).toBe("failed");
    expect(classifyDeploymentState("CANCELED")).toBe("failed");
    expect(classifyDeploymentState("DELETED")).toBe("failed");
  });

  it("treats in-flight states as pending", () => {
    expect(classifyDeploymentState("BUILDING")).toBe("pending");
    expect(classifyDeploymentState("QUEUED")).toBe("pending");
    expect(classifyDeploymentState("INITIALIZING")).toBe("pending");
  });
});

describe("findDeploymentForCommit", () => {
  const deployments = [
    { uid: "new", readyState: "BUILDING", meta: { githubCommitSha: "abc123" } },
    { uid: "old", readyState: "READY", meta: { githubCommitSha: "def456" } },
  ];

  it("matches the deployment for the given commit", () => {
    expect(findDeploymentForCommit(deployments, "def456")?.uid).toBe("old");
  });

  it("returns null while the commit's deployment is not registered yet — never a stale pass", () => {
    expect(findDeploymentForCommit(deployments, "fff999")).toBeNull();
  });

  it("falls back to the newest deployment without a sha", () => {
    expect(findDeploymentForCommit(deployments, null)?.uid).toBe("new");
    expect(findDeploymentForCommit([], "abc123")).toBeNull();
  });
});

describe("findPreviousReadyDeployment", () => {
  it("returns the newest READY deployment other than the current one", () => {
    const previous = findPreviousReadyDeployment([
      { uid: "current", readyState: "READY" },
      { uid: "broken", readyState: "ERROR" },
      { uid: "older-ready", readyState: "READY" },
    ]);
    expect(previous?.uid).toBe("older-ready");
  });

  it("returns null when there is nothing to roll back to", () => {
    expect(findPreviousReadyDeployment([{ uid: "only", readyState: "READY" }])).toBeNull();
    expect(
      findPreviousReadyDeployment([
        { uid: "current", readyState: "READY" },
        { uid: "broken", readyState: "ERROR" },
      ])
    ).toBeNull();
  });
});

describe("evaluateProbes", () => {
  const healthy = [
    { path: "/", status: 200 },
    { path: "/auth/login", status: 200 },
    { path: "/dashboard", status: 307, location: "https://big-time-inky.vercel.app/auth/login" },
    { path: "/settings/connections", status: 307 },
  ];

  it("passes when every probe matches expectations", () => {
    expect(evaluateProbes(healthy)).toEqual({ pass: true, failures: [] });
  });

  it("fails on a wrong status code", () => {
    const results = healthy.map((r) =>
      r.path === "/" ? { ...r, status: 500 } : r
    );
    const verdict = evaluateProbes(results);
    expect(verdict.pass).toBe(false);
    expect(verdict.failures).toEqual(["/: expected 200, got 500"]);
  });

  it("fails when an expected redirect points somewhere else", () => {
    const results = healthy.map((r) =>
      r.path === "/dashboard" ? { ...r, location: "https://evil.example/" } : r
    );
    const verdict = evaluateProbes(results);
    expect(verdict.pass).toBe(false);
    expect(verdict.failures[0]).toContain("/dashboard");
    expect(verdict.failures[0]).toContain("/auth/login");
  });

  it("fails when a probe result is missing entirely", () => {
    const verdict = evaluateProbes(healthy.slice(1));
    expect(verdict.pass).toBe(false);
    expect(verdict.failures).toEqual(["/: no probe result"]);
  });

  it("covers every configured probe path", () => {
    expect(PROBES.map((p) => p.path)).toEqual([
      "/",
      "/auth/login",
      "/dashboard",
      "/settings/connections",
    ]);
  });
});

describe("scanLogLines", () => {
  it("returns only error and fatal entries", () => {
    const raw = [
      JSON.stringify({ level: "info", message: "ok" }),
      JSON.stringify({ level: "error", message: "boom" }),
      JSON.stringify({ level: "warning", message: "meh" }),
      JSON.stringify({ level: "fatal", message: "dead" }),
    ].join("\n");

    const errors = scanLogLines(raw);
    expect(errors.map((e) => e.message)).toEqual(["boom", "dead"]);
  });

  it("ignores banner text and malformed lines", () => {
    const raw = [
      "Vercel CLI 55.0.0",
      "{not json",
      "",
      JSON.stringify({ level: "error", message: "real" }),
    ].join("\n");

    expect(scanLogLines(raw)).toHaveLength(1);
  });

  it("returns an empty list for empty output", () => {
    expect(scanLogLines("")).toEqual([]);
  });
});

describe("buildRollbackCommand", () => {
  it("targets the previous deployment by uid", () => {
    expect(buildRollbackCommand({ uid: "dpl_123", url: "x.vercel.app" })).toBe(
      "vercel rollback dpl_123 --scope vmalafas-projects --yes"
    );
  });

  it("falls back to the bare rollback command when no target is known", () => {
    expect(buildRollbackCommand(null)).toBe(
      "vercel rollback --scope vmalafas-projects"
    );
  });
});
