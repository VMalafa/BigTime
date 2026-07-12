// Versioned prompt artifacts for the in-app AI features (issue #21).
//
// Every in-app prompt lives as one of these — versioned, with a documented
// output contract and eval criteria — so quality survives a model downgrade
// and the /prompt-eval harness can score outputs mechanically. The app reads
// prompts exclusively from these artifacts (src/lib/ai/prompts.ts re-exports
// them); no inline prompt strings remain in routes.

export interface OutputContract {
  /** Hard ceiling the prompt itself states; the scorer enforces it. */
  maxWords: number;
  /** Structural/style rules the output must satisfy (documented). */
  rules: string[];
}

export interface PromptArtifact {
  name: string;
  /** Bump on every rewrite; v1 was the pre-artifact inline prompt. */
  version: number;
  description: string;
  outputContract: OutputContract;
  /** The system prompt the app sends. */
  system: string;
}

/** One replayable eval case: a captured, route-shaped input plus
 * expected-quality criteria the scorer checks on the model's output. */
export interface EvalCase {
  id: string;
  /** The user message exactly as the route would build it. */
  input: string;
  /** Regexes (case-insensitive) that must match the output. */
  mustMatch: string[];
  /** Regexes (case-insensitive) that must NOT match the output. */
  mustNotMatch: string[];
}

export interface EvalSuite {
  promptName: string;
  cases: EvalCase[];
}
