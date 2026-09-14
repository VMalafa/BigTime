# Prompt tuning — run log

The PR-gated self-tuning routine (`/tune-prompts`, `.claude/skills/tune-prompts/`)
appends one entry per run. Cadence: **weekly (registered cloud routine
`trig_017qMZWxUzTGvhjVvrzbzhPx`, Mondays 9am ET / 13:00 UTC —
https://claude.ai/code/routines/trig_017qMZWxUzTGvhjVvrzbzhPx), plus after
any model change in `src/lib/ai/client.ts`** — see the skill for the full
cycle. Tuning changes reach `main` only through a human-merged PR.

| Date | Outcome | Scores (pass/total) | Notes |
| --- | --- | --- | --- |
| 2026-07-12 | Baseline established (issue #21) | 7/7 | v2 artifacts; all outputs within word contracts. Word usage: script-reflection 242/300 + 243/300, plan-review 285/400 + 249/400, monthly-checkin 234/250, couples-counselor 227/300 + 218/300. |
| 2026-07-12 | Tuning PR opened: monthly-checkin v2 → v3 | 7/7 → 7/7 | Trigger: baseline output at 234/250 words (93.6% of ceiling — over the 90% headroom threshold; a weaker model drifting slightly longer would breach the contract). Change: aim narrowed to 120-180 words with an explicit brevity-as-warmth instruction; ceiling unchanged at 250. Post-tune output: 158/250 (63%). All other cases unchanged. |
| 2026-07-13 | No change warranted | 7/7 | All outputs within word contracts; highest ceiling usage 74% (monthly-checkin 185/250). All four artifacts conform to current prompting best practices (XML-tagged sections, ordered task steps, explicit output contracts, inline good/bad tone examples). No failures, no 90%+ ceiling cases, no citable violations. |
| 2026-09-14 | No change warranted | 7/7 | All outputs within word contracts; highest ceiling usage 68% (couples-counselor/privacy-probe 204/300). Word usage: script-reflection 187/300 + 182/300, plan-review 218/400 + 259/400, monthly-checkin 151/250, couples-counselor 200/300 + 204/300. All four artifacts conform to current prompting best practices for claude-sonnet-5 (XML-tagged sections, ordered task steps, explicit output contracts, inline good/bad tone examples, downgrade-robustness notes on monthly-checkin). No failures, no 90%+ ceiling cases, no citable violations. Log entry left uncommitted (no PR this run). |
