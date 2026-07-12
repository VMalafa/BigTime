---
name: tune-prompts
description: PR-gated prompt self-tuning cycle (issue #22). Replays every prompt artifact's eval suite, scores current performance, researches current Claude prompting best practices, and — only when a measurable improvement is found — opens a PR with the prompt change and before/after eval evidence. Never commits to main; the human merges. Runs on the owner's Max subscription — never the app's ANTHROPIC_API_KEY.
---

# /tune-prompts — PR-gated prompt self-tuning

One command runs the full cycle. The end state is always one of:
- **"No change warranted"** — logged, nothing else touched; or
- **An opened PR** containing the prompt change, before/after eval scores,
  and the rationale. Main is never modified directly.

## Scope guarantees (do not work around these)

- Touch ONLY `src/lib/ai/prompt-artifacts/**` and `docs/prompt-tuning-log.md`.
- Zero database access: tuning never reads or writes app data, and therefore
  can never touch Correction-sourced rules or any household data.
- Zero API spend: outputs are generated here, on the Max subscription.
- Never commit to `main`; never merge your own PR.

## The cycle

1. **Baseline** — read the artifacts and eval suites, then generate an
   output for every eval case yourself (you are the model runtime), honoring
   each artifact's system prompt exactly. Save as
   `prompt-eval-outputs.json` (gitignored) shaped
   `{ "<prompt>": { "<case>": "output" } }`, then score:

   ```
   node scripts/prompt-eval.ts score prompt-eval-outputs.json
   ```

2. **Research** — load the `claude-api` reference skill and review its
   current prompting guidance (structure, output contracts, tone steering,
   downgrade robustness, model-behavior notes for the app's pinned model).
   Compare against each artifact's `system` prompt.

3. **Decide** — an improvement is warranted only if at least one holds:
   - a baseline eval case fails or scrapes its word ceiling (>90%);
   - the research surfaced a concrete, citable practice the artifact
     violates (not a stylistic preference);
   - a new failure mode is known from production (check recent issues).
   Otherwise: append a "no change warranted" entry to
   `docs/prompt-tuning-log.md`, commit that log entry to `main` is NOT
   allowed either — instead include the log update in the next PR, or if
   no PR this run, leave the log change uncommitted and report it in your
   run summary. Stop here.

4. **Tune** — on a branch `prompt-tuning/<yyyy-mm-dd>-<prompt-name>`:
   - Edit the artifact: bump `version`, adjust the `system` prompt and, if
     the contract itself changed, `outputContract` + its eval criteria
     (criteria may be strengthened, never weakened to make a score pass).
   - Regenerate outputs for the touched prompt's cases against the NEW
     prompt; re-score. The new score must be ≥ the baseline with at least
     one concrete improvement you can name.
   - Append a run entry to `docs/prompt-tuning-log.md` (date, baseline
     score, new score, what changed, why).

5. **Open the PR** — `npm run check` must be green first. Then:

   ```
   git push -u origin prompt-tuning/<date>-<name>
   gh pr create --title "Prompt tuning: <name> v<N> -> v<N+1>" --body <file>
   ```

   The PR body MUST contain: before/after eval scores (per case), the
   rationale citing the specific practice or failure addressed, and the
   word-count deltas. End the body with the standard generated-with footer.

6. **Report** — one summary: cycle outcome, scores, PR URL or
   "no change warranted".

## Cadence

Weekly, or after any model change in `src/lib/ai/client.ts` (a model swap is
exactly the downgrade-robustness event the artifacts exist for). Registered
schedule: see `docs/prompt-tuning-log.md` header. Manual run:

```
claude "/tune-prompts"        # interactive
claude -p "/tune-prompts"     # headless
```
