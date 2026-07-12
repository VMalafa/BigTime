import { couplesCounselorArtifact } from "./couples-counselor.ts";
import { monthlyCheckinArtifact } from "./monthly-checkin.ts";
import { planReviewArtifact } from "./plan-review.ts";
import { scriptReflectionArtifact } from "./script-reflection.ts";
import type { PromptArtifact } from "./types.ts";

export {
  couplesCounselorArtifact,
  monthlyCheckinArtifact,
  planReviewArtifact,
  scriptReflectionArtifact,
};
export type { PromptArtifact, EvalCase, EvalSuite, OutputContract } from "./types.ts";

/** Every in-app prompt, by name — the eval harness iterates this. */
export const PROMPT_ARTIFACTS: readonly PromptArtifact[] = [
  scriptReflectionArtifact,
  planReviewArtifact,
  monthlyCheckinArtifact,
  couplesCounselorArtifact,
];
