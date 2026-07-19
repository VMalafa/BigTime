# Superseded: inbound email now runs on CloudMailin

Postmark's signup requires an email address on a private domain the
household doesn't have ([their policy](https://postmarkapp.com/blog/why-cant-i-use-gmail-address)),
so the inbound spine's active provider is **CloudMailin** — see
[cloudmailin-inbound.md](./cloudmailin-inbound.md).

The `/api/inbound/postmark` route stays wired (the spine is
provider-agnostic; only the payload normalizer differs), so switching back
if the household ever owns a domain is a runbook change, not a build.
