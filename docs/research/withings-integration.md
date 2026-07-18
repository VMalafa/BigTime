# Withings integration: what the API offers and the read-only posture

Research for [Withings integration (#45)](https://github.com/VMalafa/BigTime/issues/45), on the map [Whole-life optimization (#39)](https://github.com/VMalafa/BigTime/issues/39). The household asked (2026-07-18) to "integrate health data from the withings app."

## What is readable

The [Withings Public Health Data API](https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/public-health-data-api-overview/) exposes, read-only, everything the Withings app itself collects — the household's devices decide which rows actually flow:

| Category | Service | What arrives | Notes |
| --- | --- | --- | --- |
| Body measures | `Measure - Getmeas` | Weight, fat/muscle/water mass, height, blood pressure, heart rate, SpO2, body temperature, pulse-wave velocity | Timestamped point measures; the workhorse endpoint |
| Daily activity | `Measure v2 - Getactivity` | Steps, distance, calories, elevation per day | Daily rollups; intraday granularity exists via `Getintradayactivity` but needs a tracker or Apple Health linkage |
| Sleep | `Sleep v2 - Getsummary` / `Get` | Nightly summaries (duration, deep/light/REM, interruptions, HR during sleep) and raw series | Requires a Withings sleep tracker or watch |
| Heart | `Heart v2` | ECG recordings, heart events | Device-dependent (ScanWatch, BPM Core) |

Newer [API plans](https://developer.withings.com/developer-guide/v3/withings-solutions/withings-api-plans/) group metrics into "Biomarker Packs" (Basic vs Total); the free public tier covers the basics above, but the exact pack boundaries should be confirmed against the dashboard when the developer app is created — flagged on the setup task.

## Access model — and the ADR-0001 fit

This would be the app's **second aggregator**, and it wears the same posture as the first ([ADR-0001](../adr/0001-read-only-aggregation-no-credential-custody.md)):

- **OAuth2 web flow** ([docs](https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/get-access/oauth-web-flow/)): the household authenticates *at Withings* and grants scopes — `user.info`, `user.metrics`, `user.activity`, `user.sleepevents`. The app never sees credentials, only tokens. Consent is revocable from the Withings side at any time.
- **Tokens** ([docs](https://support.withings.com/hc/en-us/articles/360018514178--API-Improving-the-refresh-token-expiration)): short-lived access tokens; refresh tokens live ~1 year and **rotate on every refresh** — each refresh returns a new refresh token that must replace the stored one. Implementation note: refresh handling must be write-through and race-safe (two concurrent refreshes can orphan the stored token), the same discipline the `AggregatorConnection` record already models for the bank feed.
- **Push, not poll**: the [Notify service](https://developer.withings.com/developer-guide/v3/integration-guide/dropship-sdk/data-api/fetch-data-example/) POSTs to a callback URL when new data lands (per-category `appli` codes, with a `startdate`/`enddate` window to fetch). A Vercel route handles this fine; polling remains the fallback. Notification is a *doorbell* — the payload carries no health data; the app fetches through the authenticated API after each ring.
- **Data residency**: Withings hosts on its EU cloud (GDPR, ISO 27001, HDS-certified) — the health data stays theirs; the app stores only what it fetches, which should be the minimum the feature (#46) needs.

## Developer realities

- **Free**: a developer account and app registration cost nothing and have no prerequisites ([partner hub](https://developer.withings.com/)); the dashboard offers a demo user for building before real devices are linked.
- **Callback URL**: OAuth redirect and Notify callback both need public HTTPS — the Vercel deployment already qualifies; local dev needs a tunnel or the demo user.
- **Rate limits**: request-rate caps apply (historically ~120 requests/minute) — far above a single household's needs; a nightly sync plus Notify-triggered fetches won't approach them.
- **Single-household fit**: nothing in the free tier blocks a one-household integration; the "partner"/medical tiers exist for fleets and clinical use and are irrelevant here.

## How it flows through the app — and where it must not go

- **Measures are facts, not Proposals.** Unlike the bank feed, a weight reading needs no categorization and no ratification — it lands as-is in its own store (a `HealthMeasure` table keyed by Withings user + measure type + timestamp; dedup is natural). The ratification spine applies one level up: anything *derived* that wants surface area (a trend flag, a Today-glance line, a health-weather state) is drafted and the household ratifies its presence, per the universal ingest-then-ratify pattern (#41).
- **Per-Profile, not per-Household.** Withings accounts are personal; a connection hangs off a Profile (dad's scale data is his), mirroring how `LinkedAccount` hangs off a Profile today. Whether both partners connect is #46's question.
- **Health never touches money uninvited.** No health-conditioned spending nudges, no "you slept badly, skip the coffee" — the Honesty Rule and the no-shame stance (Dial Drift's "patterns, not judgment") generalize. What health data *does* — a Today-glance line, travel-mode sleep context, Milestone-style streaks — is exactly ticket [#46](https://github.com/VMalafa/BigTime/issues/46), and nothing ships before it resolves.

## Recommendation

Feasible, free, and architecturally boring in the best way: OAuth2 connection record (reusing the `AggregatorConnection` shape), a Notify webhook route, a small measure store, nightly reconciliation sync. The two open ends are human ones: create the developer app and link the household's real account (setup task, charted separately), and decide the crucial simple functionality in #46 before any surface is built.

### Sources

- [Withings Partner Hub](https://developer.withings.com/) · [API reference](https://developer.withings.com/api-reference/)
- [Public API integration guide](https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/public-health-data-api-overview/) · [Available health data](https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/data-api/all-available-health-data/) · [OAuth web flow](https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/get-access/oauth-web-flow/) · [API plans](https://developer.withings.com/developer-guide/v3/withings-solutions/withings-api-plans/)
- [Refresh token rotation](https://support.withings.com/hc/en-us/articles/360018514178--API-Improving-the-refresh-token-expiration) · [Notify fetch example](https://developer.withings.com/developer-guide/v3/integration-guide/dropship-sdk/data-api/fetch-data-example/)
- [Postman: Withings Public API Integration](https://www.postman.com/withings/withings-health-solutions/documentation/hx5ar4t/withings-public-api-integration) · [Wearipedia: Withings Sleep](https://wearipedia.readthedocs.io/en/latest/notebooks/withings_sleep.html)
