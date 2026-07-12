// Deterministic scoring for prompt-eval outputs. No model calls, no API
// spend — outputs are generated on the owner's Claude Code (Max
// subscription) and scored mechanically here.

import { PROMPT_ARTIFACTS } from "./index.ts";
import { EVAL_SUITES } from "./eval-cases.ts";
import type { EvalCase, PromptArtifact } from "./types.ts";

export interface CaseScore {
  promptName: string;
  caseId: string;
  pass: boolean;
  failures: string[];
  wordCount: number;
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Scores one model output against the artifact's contract + case criteria. */
export function scoreOutput(
  artifact: PromptArtifact,
  evalCase: EvalCase,
  output: string
): CaseScore {
  const failures: string[] = [];
  const words = wordCount(output);

  if (output.trim().length === 0) failures.push("empty output");
  if (words > artifact.outputContract.maxWords) {
    failures.push(
      `${words} words exceeds the ${artifact.outputContract.maxWords}-word contract`
    );
  }
  for (const pattern of evalCase.mustMatch) {
    if (!new RegExp(pattern, "im").test(output)) {
      failures.push(`missing required pattern: /${pattern}/`);
    }
  }
  for (const pattern of evalCase.mustNotMatch) {
    if (new RegExp(pattern, "im").test(output)) {
      failures.push(`contains forbidden pattern: /${pattern}/`);
    }
  }

  return {
    promptName: artifact.name,
    caseId: evalCase.id,
    pass: failures.length === 0,
    failures,
    wordCount: words,
  };
}

export interface OutputsFile {
  /** promptName -> caseId -> model output text */
  [promptName: string]: Record<string, string>;
}

/** Scores a full outputs file across every suite; missing outputs fail. */
export function scoreAll(outputs: OutputsFile): CaseScore[] {
  const scores: CaseScore[] = [];
  for (const suite of EVAL_SUITES) {
    const artifact = PROMPT_ARTIFACTS.find((a) => a.name === suite.promptName);
    if (!artifact) {
      throw new Error(`Eval suite for unknown prompt: ${suite.promptName}`);
    }
    for (const evalCase of suite.cases) {
      const output = outputs[suite.promptName]?.[evalCase.id];
      if (output === undefined) {
        scores.push({
          promptName: suite.promptName,
          caseId: evalCase.id,
          pass: false,
          failures: ["no output provided for this case"],
          wordCount: 0,
        });
      } else {
        scores.push(scoreOutput(artifact, evalCase, output));
      }
    }
  }
  return scores;
}
