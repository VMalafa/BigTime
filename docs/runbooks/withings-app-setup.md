# Runbook: Withings developer app setup (#47)

Human-in-the-loop task — needs the household's Withings login, ~10 minutes.
Everything the build chain (#67, #68) consumes is named here; use these exact
values so the code and the registration can't drift apart. Background:
[the Withings research](../research/withings-integration.md) (#45).

## 1. Create the developer account

Sign up (free, no prerequisites) at
[developer.withings.com](https://developer.withings.com/) → **Get started** /
partner dashboard. Use the household's regular Withings account — the same one
the devices sync to — so the developer dashboard and the data live together.

## 2. Register the application

In the dashboard, create a new application (the free **Public API** /
public-cloud integration, not the Pro/medical tiers). Paste-ready values:

| Field | Value |
| --- | --- |
| Application name | `BigTime` |
| Description | Single-household read-only health dashboard |
| Callback / redirect URL | `https://big-time-inky.vercel.app/api/withings/callback` |
| Environment | Public API (free) |

Notes:

- The callback URL registered here is the **OAuth redirect** only. The Notify
  webhook (`https://big-time-inky.vercel.app/api/withings/notify`) is declared
  later, at subscribe time, by #67's code — it does not go on this form.
- Scopes (`user.info,user.metrics,user.activity,user.sleepevents`) are
  requested during the OAuth flow, not at registration.
- Registration issues a **Client ID** and a **Secret**. Keep the tab open for
  step 3; the secret may be shown only once.

## 3. Record the credentials — Vercel env vars, never the repo

Add to the Vercel project `vmalafas-projects/big-time` (dashboard → Settings →
Environment Variables, or CLI):

```bash
vercel env add WITHINGS_CLIENT_ID production
vercel env add WITHINGS_CLIENT_SECRET production
```

These names are the contract with #67 (`.env.example` reserves them). Add them
to Development too if you plan to run the OAuth flow locally against the demo
user; Preview deployments can't complete OAuth anyway (Withings redirects only
to the registered callback URL).

## 4. Confirm the Biomarker Pack

The research (#45) flagged that the free tier's exact pack boundaries
(Basic vs Total) need dashboard verification. With the app created, check the
app's page in the developer dashboard for which **Biomarker Pack / data
categories** are granted, and record the answer in the resolution comment.

## 5. Inventory the devices

List which Withings devices the household actually owns (scale, BPM, sleep
mat, watch…). That list decides which rows of the research doc's data table
are live rather than theoretical — e.g. sleep endpoints need a sleep tracker,
ECG needs ScanWatch/BPM Core.

## 6. Resolve #47

Post a resolution comment on
[#47](https://github.com/VMalafa/BigTime/issues/47) recording:

```markdown
## Resolution

- Developer app registered as `BigTime`; callback
  `https://big-time-inky.vercel.app/api/withings/callback`.
- `WITHINGS_CLIENT_ID` / `WITHINGS_CLIENT_SECRET` set in Vercel (production).
- Biomarker Pack granted: <what the dashboard shows>
- Devices owned: <list> → live data categories: <weight / BP / sleep / activity…>
```

Then close #47 — #67 (connection & measure store) unblocks.
