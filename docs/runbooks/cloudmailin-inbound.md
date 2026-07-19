# Inbound email: CloudMailin setup + the Gmail auto-forward filter

The email spine (#69, per [ingestion-streams](../research/ingestion-streams.md)),
on **CloudMailin** — the provider swap from Postmark, whose signup requires a
private-domain email address the household doesn't have. CloudMailin signs up
with any address, its free plan (10,000 emails/month) dwarfs household
volume, and the spine is identical: forwarded emails hit a unique inbound
address, CloudMailin POSTs JSON to the app, the raw payload lands in
Supabase Storage, and extraction produces draft Events into the tiered
review surface. Nothing is ever silently dropped — parked emails are listed
on `/dashboard/calendar` under "Forwarded email".

## One-time setup (~15 minutes, human)

### 1. CloudMailin address

1. Create a free account at [cloudmailin.com](https://www.cloudmailin.com)
   (any email address works).
2. Create an **address** — you get a unique `…@cloudmailin.net` target. No
   domain or DNS work.
3. Set the address's **target URL** to:

   ```
   https://big-time-inky.vercel.app/api/inbound/cloudmailin?secret=<INBOUND_EMAIL_SECRET>
   ```

4. Set the **POST format** to **JSON (Normalized)** and choose **embedded
   attachments** (attachments arrive base64 inside the JSON — the `.ics`
   path depends on it).

### 2. Vercel environment variables

Add to the production environment (Vercel → Settings → Environment Variables):

| Variable | Value |
| --- | --- |
| `INBOUND_EMAIL_SECRET` | a long random string (e.g. `openssl rand -base64 32`) — the same one in the target URL |
| `INBOUND_EMAIL_USER_EMAIL` | the household login email — inbound mail is attributed to this account |
| `SUPABASE_SERVICE_ROLE_KEY` | already used locally; needed in Vercel for the Storage write |

(The route also accepts the older `POSTMARK_INBOUND_*` names as fallbacks.)
The `inbound-email` Storage bucket is created automatically (private) on the
first email — no Supabase dashboard step.

### 3. Gmail auto-forward filter (zero-typing upgrade)

1. Gmail → Settings → **Forwarding and POP/IMAP** → "Add a forwarding
   address" → paste the CloudMailin address.
2. Gmail sends a verification email to that address — **it arrives through
   the webhook** and appears parked under "Forwarded email" on
   `/dashboard/calendar` with Google's confirmation code in the subject.
   Enter the code in Gmail.
3. Create a filter: search
   `from:(finalsite.net OR corbettprep.com)` (add renewal senders —
   insurer, registration, camps — as they show up) → "Forward it to" the
   CloudMailin address. Selection logic stays in Gmail; custody stays at
   zero-beyond-forwarded-content (ADR-0001 posture).

## What the route does with each email

1. Rejects anything without the secret (401).
2. Stores the raw JSON payload (attachments included) at
   `inbound-email/<userId>/<MessageID>.json`.
3. `.ics` attachments ride the deterministic #55 import path.
4. Otherwise the body runs the #57 calendar extraction (school emails), then
   the renewal extraction (surfaced by #70) — drafts land in the tiered
   review surface.
5. Anything unreadable parks visibly with a plain-language note.

Retried webhooks are idempotent on the email's `Message-ID`.
