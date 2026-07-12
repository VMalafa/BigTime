import { describe, expect, it } from "vitest";
import { PROMPT_ARTIFACTS } from "./index.ts";
import { EVAL_SUITES } from "./eval-cases.ts";
import { scoreAll, scoreOutput, wordCount } from "./scoring.ts";
import {
  COUPLES_COUNSELOR_PROMPT,
  MONTHLY_CHECKIN_PROMPT,
  PLAN_REVIEW_PROMPT,
  SCRIPT_REFLECTION_PROMPT,
} from "../prompts";

describe("prompt artifacts", () => {
  it("every in-app prompt is a versioned artifact with a contract and rules", () => {
    expect(PROMPT_ARTIFACTS.map((a) => a.name)).toEqual([
      "script-reflection",
      "plan-review",
      "monthly-checkin",
      "couples-counselor",
    ]);
    for (const artifact of PROMPT_ARTIFACTS) {
      expect(artifact.version).toBeGreaterThanOrEqual(2);
      expect(artifact.outputContract.maxWords).toBeGreaterThan(0);
      expect(artifact.outputContract.rules.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("every artifact's system prompt is structured: role, task, and its documented output contract", () => {
    for (const artifact of PROMPT_ARTIFACTS) {
      expect(artifact.system).toContain("<role>");
      expect(artifact.system).toContain("<task>");
      expect(artifact.system).toContain("<output_contract>");
      // The stated word ceiling appears in the prompt itself.
      expect(artifact.system).toContain(String(artifact.outputContract.maxWords));
    }
  });

  it("the app reads prompts from the artifacts (re-export surface unchanged)", () => {
    const byName = Object.fromEntries(PROMPT_ARTIFACTS.map((a) => [a.name, a]));
    expect(SCRIPT_REFLECTION_PROMPT).toBe(byName["script-reflection"].system);
    expect(PLAN_REVIEW_PROMPT).toBe(byName["plan-review"].system);
    expect(MONTHLY_CHECKIN_PROMPT).toBe(byName["monthly-checkin"].system);
    expect(COUPLES_COUNSELOR_PROMPT).toBe(byName["couples-counselor"].system);
  });

  it("every prompt has an eval suite with route-shaped inputs and valid criteria regexes", () => {
    expect(EVAL_SUITES.map((s) => s.promptName).sort()).toEqual(
      PROMPT_ARTIFACTS.map((a) => a.name).sort()
    );
    for (const suite of EVAL_SUITES) {
      expect(suite.cases.length).toBeGreaterThanOrEqual(1);
      for (const evalCase of suite.cases) {
        expect(evalCase.input.length).toBeGreaterThan(40);
        for (const pattern of [...evalCase.mustMatch, ...evalCase.mustNotMatch]) {
          expect(() => new RegExp(pattern, "im")).not.toThrow();
        }
      }
    }
  });
});

describe("eval scoring", () => {
  const artifact = PROMPT_ARTIFACTS[0];
  const evalCase = EVAL_SUITES[0].cases[0];

  it("passes an output that meets the contract and criteria", () => {
    const output =
      "I noticed how you described money as something that runs out — " +
      "you learned to brace for it. That's a scarcity script, and it makes " +
      "sense given what you grew up watching. What if attention could feel " +
      "like care instead of alarm?";
    const score = scoreOutput(artifact, evalCase, output);
    expect(score.pass).toBe(true);
  });

  it("fails outputs that break the word ceiling or hit forbidden patterns", () => {
    const tooLong = Array(artifact.outputContract.maxWords + 50)
      .fill("word")
      .join(" ");
    expect(scoreOutput(artifact, evalCase, tooLong).pass).toBe(false);

    const shamey =
      "You noticed money runs out because you were irresponsible with it.";
    const score = scoreOutput(artifact, evalCase, shamey);
    expect(score.pass).toBe(false);
    expect(score.failures.some((f) => f.includes("irresponsible"))).toBe(true);
  });

  it("counts words and fails missing outputs when replaying a full file", () => {
    expect(wordCount("one two  three\nfour")).toBe(4);
    const scores = scoreAll({});
    expect(scores.every((s) => !s.pass)).toBe(true);
    expect(scores).toHaveLength(
      EVAL_SUITES.reduce((sum, s) => sum + s.cases.length, 0)
    );
  });
});
