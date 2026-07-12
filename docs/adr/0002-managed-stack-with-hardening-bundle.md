# Managed Vercel + Supabase with a hardening bundle, not self-hosting

Once bank-linked data entered scope, we chose to stay on the managed stack (Vercel + Supabase) and harden it, rather than self-host: a patched, professionally-operated platform beats a permanently self-maintained home server, and the read-only/no-credentials design (ADR-0001) already caps the blast radius at disclosure, not money movement.

The bundle, in order of importance:

1. **TOTP MFA required on the household login**; password rule raised from 8+ chars to a passphrase. One shared login guards everything — it cannot be a weak one.
2. **SimpleFIN access tokens are encrypted at the application layer** (AES-256-GCM) with the key in an environment variable, never in the database — a DB leak alone exposes no tokens.
3. **Bank data exists only behind authentication.** The anonymous/localStorage flow remains for the guided onboarding, but Linked Accounts, balances, and Transactions are never stored client-side or served to anonymous sessions.
4. Only masked account identifiers are stored; no full account numbers, no SSNs anywhere in the system.

## Considered Options

- **Self-host behind Tailscale** — maximum data custody, rejected for permanent ops burden and worse partner ergonomics.
- **Minimal hardening (plain token in env/DB, current auth)** — rejected: MFA and token encryption are cheap relative to what they protect.
