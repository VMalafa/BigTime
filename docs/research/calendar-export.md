# Getting Events out: one-off .ics download vs a subscribable household feed

Research for [Getting Events out (#35)](https://github.com/VMalafa/BigTime/issues/35), on the map [The household timeline (#31)](https://github.com/VMalafa/BigTime/issues/31). The baseline is already decided and cut: [#58](https://github.com/VMalafa/BigTime/issues/58) ships the one-off download of selected Events, format proven by the household's standalone scheduler. This research answers what the **subscribe-once** upgrade looks like and whether it's worth building.

## What subscription clients actually do

| Client | Add via | Refresh cadence | Notes |
| --- | --- | --- | --- |
| Apple Calendar (iOS/macOS) | `webcal://` or https URL | **Hourly by default; user-configurable 5 min – weekly** | The household's primary surface; effectively live |
| Outlook (web) | "Add from web" | ~3 hours | Fine |
| Google Calendar | "From URL" | **~12–24 h, not configurable, no manual refresh** | The laggard; a fetch URL must be plain https — clients send no auth headers |

Two consequences: (1) the feed URL must be a **capability URL** — a long random token *is* the auth, because subscription clients cannot send credentials; (2) expectation-setting copy matters ("Google can take up to a day to notice changes"). For school-calendar reissues that lag is harmless — "UPDATED 6/3/26" changes next month's days, not today's.

## The private feed on this stack

- **Route**: `GET /api/calendar/feed/<token>.ics` on the existing Vercel deployment, serving the household's CONFIRMED Events as `VEVENT`s (same date-only subset as #58; no `RRULE` — school calendars enumerate occurrences, and the feed regenerates in full on every fetch, which is exactly how updates propagate).
- **Token = revocable consent** (ADR-0001's posture, outbound): a long random token minted per feed, shown once as a `webcal://` link + QR in settings, revocable/rotatable there. Revoke = every subscribed device silently stops updating. No token enumeration: constant-time lookup, 404 on miss, modest rate limit.
- **Scope choices per feed**: whole Household Timeline (life Events) or a single Calendar Source ("just Corbett" — shareable with a grandparent or sitter without exposing the family's whole year).
- **Money moments stay out of the feed by default.** External calendar infrastructure stores whatever it fetches (Google keeps a server-side copy). Life Events are school-public anyway; Earmark amounts and paydays are not. This follows the #46 precedent — a default, not a hard rule; a future ticket can add an opt-in "include money rhythm" feed.
- Cost: one dynamic route, no storage beyond the token record, no cron — subscription clients do the polling.

## The one-off download still earns its keep

Even with a feed, #58's download remains the right tool for: sending a curated pick-list to someone who shouldn't hold a live feed (the scheduler's original use), importing into systems that only accept files, and sidestepping Google's refresh lag when a change must land *today*.

## Worth checking, from #34's world

Corbett runs on Finalsite, and [Finalsite platforms document external calendar syncing](https://schooladmin.zendesk.com/hc/en-us/articles/6219377959181-Syncing-Calendars-with-External-Calendar-Programs) — if the school's portal exposes an iCal feed directly, it becomes a deterministic **Calendar Source** for ingestion (complementing the photo path), not a replacement for the household's own outbound feed (which carries their ratified, person-chipped, multi-source timeline).

## Recommendation

1. Ship **#58 (one-off download)** as cut — unchanged.
2. **Build the subscribable feed as a fast follow**: tokenized `webcal://` capability URL, whole-timeline and per-source scopes, life Events only by default, revoke/rotate in settings. It converts the household's real habit (subscribe once on two phones, never think about it again) into the default — the strongest version of the scheduler that started this whole effort.
3. Set refresh expectations in UI copy; recommend Apple Calendar as the primary subscriber.
4. At import time (#55/#57 world), check whether Corbett's Finalsite portal offers a direct iCal feed as an additional deterministic Calendar Source.

### Sources

- [Apple: Subscribe to calendars on Mac](https://support.apple.com/guide/calendar/subscribe-to-calendars-icl1022/mac) · [Apple: Refresh calendars](https://support.apple.com/guide/calendar/refresh-calendars-icl1024/mac)
- [Calfeed: How often Apple and Google refresh subscribed calendars](https://calfeed.ai/learn/ics-refresh-rate-apple-google) · [MoonCal: Google Calendar ICS refresh](https://usemooncal.com/en/guides/google-calendar-ics-refresh) · [Forcing Google to refresh a subscribed calendar](https://gist.github.com/gene1wood/02ed0d36f62d791518e452f55344240d)
- [Finalsite Enrollment: Syncing calendars with external programs](https://schooladmin.zendesk.com/hc/en-us/articles/6219377959181-Syncing-Calendars-with-External-Calendar-Programs)
