# Ingest, don't ask: one spine for every stream the household already produces

Research for [Ingest, don't ask (#41)](https://github.com/VMalafa/BigTime/issues/41), on the map [Whole-life optimization (#39)](https://github.com/VMalafa/BigTime/issues/39).

**Premise** (ratified in #40): this household — a traveling executive dad with toddlers — will not adopt new data-entry habits. Every domain lives or dies by what can be ingested from streams the household already produces. Ingestion completeness beats derived cleverness; zero typing; manual handling is acceptable meanwhile.

## Stream inventory

| Stream | Status | Reliable extraction yields | Failure modes |
| --- | --- | --- | --- |
| Bank/card feed (SimpleFIN, [ADR-0001](../adr/0001-read-only-aggregation-no-credential-custody.md)) | Live | Transactions, recurring patterns → income/fixed-cost/debt Proposals | ~daily lag; cryptic merchant strings (handled per [ADR-0003](../adr/0003-interval-batch-categorization-on-max-subscription.md)) |
| Photo/screenshot of paper or email | **Proven** (Corbett calendar screenshot) | Anything Claude vision can read → draft Events, renewal facts, appointment facts | Crop/blur; partial capture; all risks in [calendar-ingestion](calendar-ingestion.md)'s table |
| School emails / Finalsite newsletters (`resources.finalsite.net`) | Next | Dated Events with category, note, range — the calendar-ingestion schema, arriving incrementally instead of once a year | Marketing chrome around the facts; "UPDATED" reissues (re-import diff); date shorthand ("Thurs. 13 & Fri. 14"); year inference |
| `.ics` calendar invites (attachments) | Cheap | Deterministic Events — the Path-A parser already scoped in calendar-ingestion | Rarely offered by schools; timed events/`RRULE` deferred |
| Renewal / insurance notices | Next | Provider, policy/plan name, renewal date, premium/amount, action deadline → draft Earmark-raising Events + fixed-cost cross-check against the feed | Amount ambiguity (old vs. new premium in one letter); auto-renew vs. action-required; PDF-only bodies (screenshot path covers) |
| Appointment reminders (medical, dental, vet) | Next | Who, provider, date/time, location → draft Events | Reschedule chains (latest email wins — needs the re-import diff idea); portal links instead of inline facts |
| Airline/hotel/rental confirmations | **Deferred** (travel domain) | Confirmation code, dates, traveler, amount | Multi-leg parsing; frequent schedule-change emails; do not build until the travel domain exists |

Extraction runs on Claude vision/text via `@anthropic-ai/sdk` with a structured-output tool schema, exactly as calendar-ingestion specifies. Which key pays follows its reasoning unchanged: forwarded-email extraction is user-adjacent, bursty, and low-volume (a few emails a week) — the app's `ANTHROPIC_API_KEY`, costing cents. Only if a stream ever becomes a standing high-volume batch does ADR-0003's Max-subscription pattern apply.

## One spine: the Proposal pattern generalized

The app already has the answer twice — `src/lib/proposals/proposals.ts` for the money feed, Calendar Source drafts for Events — and both say the same sentence: **the feed drafts, the human ratifies.** Generalizing:

1. **Source** — every ingested artifact gets a source record (generalizing Calendar Source: an email, a screenshot, a feed batch) that owns provenance, its own category vocabulary, and re-import diffing.
2. **Draft** — extraction produces typed draft records (`DRAFT → CONFIRMED`), never truth: draft Events, draft fixed-cost line items, draft Debts. Measures-as-facts (Withings, [withings-integration](withings-integration.md)) are the one exception — ratification there applies to derived surfaces, not readings.
3. **One review surface, tiered** — clear-cut drafts bundle into confirm-all; ambiguous or plan-moving ones ask individually (`CONFIRM_ALL_MIN_CONFIDENCE = 0.75` precedent; income always individual; for Events: ranges, year-boundaries, "&"-dates).
4. **Dismissals remembered** — `decidedPatterns`-style: a rejected draft never re-raises on re-ingest; human edits win over reissued sources, in the Correction spirit.

New streams therefore add only an extractor and a draft type — never a new review UX.

## Email access paths, ranked by least credential custody

Per ADR-0001, the app's scope is insight, not custody of secrets. Ranked least-custody first:

| Path | Custody/scope risk | Setup (one household) | Reliability | Vercel+Supabase shape |
| --- | --- | --- | --- | --- |
| **(a) Manual screenshot/paste** | Zero — nothing granted | None; works today | Human-dependent, but proven | Existing vision/text extraction route |
| **(b) Forward-to address** | Only what the human (or a filter) chooses to forward; no inbox access; revoke = stop forwarding | Minutes–an hour | High once the Gmail filter exists; webhook retries on failure | Inbound provider POSTs parsed JSON to a Vercel API route → verify webhook secret → store raw in Supabase Storage → extract → drafts |
| **(c) Gmail read-only OAuth** | Whole-inbox read grant — the email analog of the credential vault ADR-0001 rejected | Weeks-to-impractical (below) | Fragile for an unverified app | Token store + polling/watch — heaviest build |

**(b) Forward-to options**, verified July 2026:

- **[Postmark inbound](https://postmarkapp.com/developer/user-guide/inbound/parse-an-email)** — every server gets a unique `…@inbound.postmarkapp.com` address; no domain or DNS work at all. Parsed [JSON webhook](https://postmarkapp.com/developer/webhooks/inbound-webhook) (From/Subject/HtmlBody/TextBody + base64 attachments — the `.ics` path is free). The [developer plan](https://postmarkapp.com/pricing) is free, 100 emails/month, non-expiring — ample for one household; paid inbound sits on Pro tiers ($15/mo, 10k) if ever outgrown.
- **[Cloudflare Email Routing + Email Workers](https://developers.cloudflare.com/email-routing/email-workers/)** — free with [no message-volume limit](https://developers.cloudflare.com/email-service/platform/limits/) (25 MiB/message cap); a worker receives `ingest@their-domain` and `fetch()`es the raw MIME to the Vercel route. Nicer address, but requires the domain's DNS on Cloudflare and hand-rolled MIME parsing; Workers-free CPU limits can drop very large messages.
- **SendGrid Inbound Parse** — works, but the [free tier is now a 60-day trial](https://www.twilio.com/en-us/products/email-api/pricing), not a standing free plan. Poor fit; skip.

Zero-typing upgrade: a Gmail *filter* auto-forwarding `from:(finalsite.net OR corbettprep)` to the inbound address makes school ingestion fully passive — Gmail's one-time forwarding-verification code itself arrives through the webhook, so confirming it is a single glance. This keeps all selection logic in Gmail, custody at zero-beyond-forwarded-content.

**(c) Gmail read-only, why it ranks last**: `gmail.readonly` is a [restricted scope](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) — production verification requires an annual CASA Tier 2/3 security assessment, absurd for one household. The personal-use escape hatches are real but degraded: an app left in **Testing** status has [authorizations and refresh tokens that expire every 7 days](https://developers.google.com/identity/protocols/oauth2#expiration), forcing weekly re-consent; publishing unverified caps users and shows the scare screen, and restricted scopes are not meant to ship that way. Label-scoped filtering doesn't shrink the grant — the scope is still the whole inbox. Maximum custody, minimum reliability.

## Recommendation

1. **Keep (a) manual screenshot/paste as the floor** — zero custody, already proven, and it remains the path for paper documents regardless of what else ships. Manual handling meanwhile is explicitly acceptable (#40).
2. **Build (b) forward-to first, via Postmark's unique inbound address** — no DNS work, free at household volume, parsed JSON with attachments delivered straight to a Vercel API route. One route, one webhook secret, raw email into Supabase Storage, then the existing extraction → tiered draft review. Add the Gmail auto-forward filter for Finalsite/Corbett and renewal senders to reach zero typing. Cloudflare Email Routing is the upgrade if the household later wants `ingest@their-domain` and moves DNS; the Vercel route is identical either way.
3. **Do not build (c) Gmail OAuth.** The 7-day testing expiry or a CASA assessment are both wrong for one household, and whole-inbox custody contradicts ADR-0001's posture.
4. Streams ride the one spine in this order: school emails/Finalsite (proven need), renewal/insurance notices and appointment reminders (same extractor, new draft types), `.ics` attachments (free once Postmark delivers them); travel confirmations wait for the travel domain.

### Sources

- [Cloudflare Email Routing limits](https://developers.cloudflare.com/email-service/platform/limits/) · [Email Workers API](https://developers.cloudflare.com/email-routing/email-workers/) · [Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/)
- [Postmark inbound guide](https://postmarkapp.com/developer/user-guide/inbound/parse-an-email) · [Inbound webhook JSON](https://postmarkapp.com/developer/webhooks/inbound-webhook) · [Postmark pricing](https://postmarkapp.com/pricing)
- [Twilio SendGrid pricing](https://www.twilio.com/en-us/products/email-api/pricing)
- [Google restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) · [OAuth 2.0 token expiration](https://developers.google.com/identity/protocols/oauth2#expiration) · [Manage app audience / testing status](https://support.google.com/cloud/answer/15549945?hl=en)
