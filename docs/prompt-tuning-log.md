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
