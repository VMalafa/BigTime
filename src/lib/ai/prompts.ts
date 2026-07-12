// The app reads every AI prompt from the versioned artifacts in
// ./prompt-artifacts (issue #21) — no inline prompt strings live here or in
// routes. These re-exports keep the existing import surface stable.

import {
  couplesCounselorArtifact,
  monthlyCheckinArtifact,
  planReviewArtifact,
  scriptReflectionArtifact,
} from "./prompt-artifacts";

export const SCRIPT_REFLECTION_PROMPT = scriptReflectionArtifact.system;
export const PLAN_REVIEW_PROMPT = planReviewArtifact.system;
export const MONTHLY_CHECKIN_PROMPT = monthlyCheckinArtifact.system;
export const COUPLES_COUNSELOR_PROMPT = couplesCounselorArtifact.system;
