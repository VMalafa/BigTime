// Prompt eval harness (issue #21). Runs on the owner's Claude Code (Max
// subscription) — never the app's ANTHROPIC_API_KEY.
//
//   node scripts/prompt-eval.ts render
//     Prints every (system prompt, eval-case input) pair so Claude Code can
//     generate outputs. Save them as JSON: { "<prompt>": { "<case>": "..." } }
//
//   node scripts/prompt-eval.ts score <outputs.json>
//     Replays every eval case against the saved outputs and scores them
//     against each prompt's output contract + per-case criteria. Exits
//     nonzero if any case fails.

import { readFileSync } from "node:fs";
import { PROMPT_ARTIFACTS } from "../src/lib/ai/prompt-artifacts/index.ts";
import { EVAL_SUITES } from "../src/lib/ai/prompt-artifacts/eval-cases.ts";
import { scoreAll, type OutputsFile } from "../src/lib/ai/prompt-artifacts/scoring.ts";

function render() {
  for (const suite of EVAL_SUITES) {
    const artifact = PROMPT_ARTIFACTS.find((a) => a.name === suite.promptName)!;
    console.log(`\n${"=".repeat(70)}`);
    console.log(`PROMPT: ${artifact.name} (v${artifact.version})`);
    console.log(`CONTRACT: <= ${artifact.outputContract.maxWords} words`);
    for (const rule of artifact.outputContract.rules) console.log(`  - ${rule}`);
    console.log(`\n--- SYSTEM ---\n${artifact.system}`);
    for (const evalCase of suite.cases) {
      console.log(`\n--- CASE ${evalCase.id} (user message) ---\n${evalCase.input}`);
    }
  }
}

function score(path: string) {
  const outputs = JSON.parse(readFileSync(path, "utf8")) as OutputsFile;
  const scores = scoreAll(outputs);
  let failed = 0;
  for (const s of scores) {
    const mark = s.pass ? "PASS" : "FAIL";
    console.log(`${mark}  ${s.promptName}/${s.caseId}  (${s.wordCount} words)`);
    for (const failure of s.failures) console.log(`      - ${failure}`);
    if (!s.pass) failed++;
  }
  console.log(`\n${scores.length - failed}/${scores.length} eval case(s) passed`);
  if (failed > 0) process.exit(1);
}

const [command, argument] = process.argv.slice(2);
if (command === "render") render();
else if (command === "score" && argument) score(argument);
else {
  console.log("Usage: node scripts/prompt-eval.ts render | score <outputs.json>");
  process.exitCode = 1;
}
