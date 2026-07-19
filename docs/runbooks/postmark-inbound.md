# Inbound email: Postmark setup + the Gmail auto-forward filter

The email spine (#69, per [ingestion-streams](../research/ingestion-streams.md)):
forwarded emails hit a Postmark inbound address, Postmark POSTs parsed JSON to
the app, the raw payload lands in Supabase Storage, and extraction produces
draft Events into the tiered review surface. Nothing is ever silently
dropped — parked emails are listed on `/dashboard/calendar` under
"Forwarded email".

## One-time setup (~15 minutes, human)

### 1. Postmark server

1. Create a free account at [postmarkapp.com](https://postmarkapp.com) — the
   developer plan (100 emails/month, non-expiring) is ample for one household.
2. Create a **Server**, open its **Inbound** message stream, and copy the
   unique `…@inbound.postmarkapp.com` address. No domain or DNS work.
3. Set the inbound webhook URL to:

   ```
   https://big-time-inky.vercel.app/api/inbound/postmark?secret=<POSTMARK_INBOUND_SECRET>
   ```

   using the secret you generate in step 2 below. Enable "Include raw email
   content in JSON payload" is NOT required — attachments already arrive
   base64 in the parsed payload.

### 2. Vercel environment variables

Add to the production environment (Vercel → Settings → Environment Variables):

| Variable | Value |
| --- | --- |
| `POSTMARK_INBOUND_SECRET` | a long random string (e.g. `openssl rand -base64 32`) — the same one in the webhook URL |
| `POSTMARK_INBOUND_USER_EMAIL` | the household login email — inbound mail is attributed to this account |
| `SUPABASE_SERVICE_ROLE_KEY` | already used locally; needed in Vercel for the Storage write |

The `inbound-email` Storage bucket is created automatically (private) on the
first email — no Supabase dashboard step.

### 3. Gmail auto-forward filter (zero-typing upgrade)

1. Gmail → Settings → **Forwarding and POP/IMAP** → "Add a forwarding
   address" → paste the Postmark inbound address.
2. Gmail sends a verification email to that address — **it arrives through
   the webhook** and appears parked under "Forwarded email" on
   `/dashboard/calendar` with Google's confirmation code in the subject.
   Enter the code in Gmail.
3. Create a filter: search
   `from:(finalsite.net OR corbettprep.com)` (add renewal senders — insurer,
   registration, camps — as they show up) → "Forward it to" the inbound
   address. Add more senders any time; selection logic stays in Gmail,
   custody stays at zero-beyond-forwarded-content (ADR-0001 posture).

## What the route does with each email

1. Rejects anything without the secret (401).
2. Stores the raw JSON payload (attachments included) at
   `inbound-email/<userId>/<MessageID>.json`.
3. `.ics` attachments ride the deterministic #55 import path.
4. Otherwise the body runs the #57 calendar extraction (school emails), then
   the renewal extraction (provider, date, amount, action-required —
   surfaced by #70) — drafts land in the tiered review surface.
5. Anything unreadable parks visibly with a plain-language note.

Retried webhooks are idempotent on Postmark's `MessageID`.
