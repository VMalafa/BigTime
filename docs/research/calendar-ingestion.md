# From artifact to Events: ingestion paths for school calendars

Research for [From artifact to Events (#34)](https://github.com/VMalafa/BigTime/issues/34), on the map [The household timeline (#31)](https://github.com/VMalafa/BigTime/issues/31).

**Question**: how does a school calendar become structured Events with the least ceremony? The real-world input is a phone photo of a Finalsite calendar-preview email (Corbett Prep 2026–27); the household's hand-built answer is [`assets/corbett-calendar-scheduler.html`](assets/corbett-calendar-scheduler.html), whose `EVENTS` array is the target shape: `{date, end?, title, cat, note?}` with ISO dates and an exclusive multi-day `end`.

## The three paths

### Path A — ICS import (deterministic, but rarely offered by schools)

Parsing an `.ics` is the zero-ambiguity path: the scheduler's own `buildICS` documents the exact subset that matters — `VEVENT` with `DTSTART;VALUE=DATE`, **exclusive** `DTEND`, `SUMMARY`, optional `DESCRIPTION`. A small hand-rolled parser for that date-only subset (unfold folded lines, unescape `\,` `\;` `\n`, ignore `VTIMEZONE`) covers it without a dependency; `node-ical` is the fallback if timed events or `RRULE` ever matter. Defer `RRULE` — school calendars enumerate occurrences rather than emitting recurrence rules.

The catch: Corbett publishes a PDF/HTML preview, not an ICS feed. Most schools do likewise. ICS import is worth building because it is nearly free and becomes the round-trip format (the scheduler already exports it), but it does not solve the real case alone.

### Path B — AI extraction from photo / PDF / pasted text (the real case)

Claude vision on the uploaded photo (or text extraction on pasted email/HTML) producing draft Events via a tool-call schema. This mirrors the app's founding pattern: **the feed drafts, the human ratifies** — extraction output is never calendar truth until confirmed.

**Which key pays** (the ADR-0003 question): ADR-0003 pushed *categorization* onto the owner's Max subscription because it is a recurring, batch-shaped, high-volume workload. Calendar import is the opposite: user-initiated, bursty, and rare (a handful of imports per year), exactly the "user-facing features" the app's `ANTHROPIC_API_KEY` is reserved for. Run it in-app through `src/lib/ai/client.ts` with a structured-output tool schema; cost is cents per school year. (The shared client currently pins `claude-sonnet-4-20250514`; a vision-capable current model is required for the photo path — worth a small separate issue to lift the model choice out of the client.)

**Failure modes, catalogued from the actual artifact** — each is a reason extraction must land as drafts with confidence, not as truth:

| Risk | Example from the Corbett preview | Handling |
| --- | --- | --- |
| Adjacent-days-vs-range | "Thurs. 13 & Fri. 14" is two noon dismissals, encoded as one 8/13–8/15 exclusive range by the scheduler | Extract as range; low confidence when the source uses "&" rather than "–" |
| Year inference | "Fri. 7/31" belongs to July **2026** in a "2026–27" calendar; "Mon. 12/21-Mon. 1/4/27" crosses the boundary | Prompt carries the academic-year span; any event whose inferred year is not explicit in the source gets individual attention |
| Inclusive→exclusive ends | Humans write inclusive ranges ("Mon. 23-Fri. 27"); ICS `DTEND` and the scheduler's `end` are exclusive | Normalize at extraction; show the human-readable inclusive range in review UI (the scheduler's `fmtDate` already does this) |
| Notes vs titles | Italic riders like *Extended Day Available* / *Extended Day Closed* | Separate `note` field; never concatenated into the title |
| Same-day siblings | Two distinct events on Thurs. May 27 (graduation; last day) | Extraction must not merge same-date entries |
| Category assignment | holiday / dismissal / break / event / academic chips | Model assigns from the Calendar Source's taxonomy (per #33's pending glossary decision); miscategorization is cheap because chips are editable at review |

### Path C — Manual entry (always present, never the main path)

Smart-defaulted single-event form (date, title, category chip, optional note/range). Mirrors the money flow's stance: manual entry is the fallback when ingestion fails or the event never existed on paper — not a parallel path.

## Ratification: draft Events through the Proposal spine

All three paths converge on one review surface, reusing the tiered Proposal UX verbatim (`src/lib/proposals/proposals.ts` precedent):

- **Confirm-all bundle**: clear-cut single-day events with explicit dates and confident categories — the overwhelming majority (the Corbett preview yields ~40 events, most trivially clear).
- **Individual attention**: multi-day ranges, year-boundary spans, "&"-style date lists, same-day siblings, and anything below a confidence floor (precedent: `CONFIRM_ALL_MIN_CONFIDENCE = 0.75`).

Model shape (for #33 to name properly): a **Calendar Source** record per import (school, artifact, "UPDATED 6/3/26" stamp) owning draft Events with a `DRAFT → CONFIRMED` status; dismissals remembered `ProposalDecision`-style so a re-import never re-raises a rejected event.

## Re-import and dedup

The source itself says "UPDATED 6/3/26" — schools reissue calendars. Recommendation: natural key = (Calendar Source, start date, normalized title); on re-import diff into **new / changed / removed / unchanged**, where unchanged auto-passes, new goes through the normal tiers, and changed-or-removed events that a human has edited get individual attention — human edits win, in the Correction spirit.

## Recommendation

Build in this order, all funneling into the same draft-Event review:

1. **Manual entry + ICS-subset import** — the deterministic core; small, testable, and immediately round-trips the household's existing scheduler export.
2. **AI extraction (photo / pasted text)** — the actual need; in-app on the app's API key with a structured-output schema and the confidence tiers above.
3. **Re-import diff** — once Calendar Sources exist; this is what makes the "school sent an updated calendar" moment a one-glance confirm instead of a re-transcription.

PDF ingestion needs no separate path: a photo/screenshot of the PDF goes through the vision path, and pasted text through the text path — one extraction pipeline, two mouths.
