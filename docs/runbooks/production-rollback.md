# Runbook: production verification & rollback

Production (`big-time-inky.vercel.app`, Vercel project `vmalafas-projects/big-time`)
auto-deploys from every push to `main`.

## Verify the current production deployment

```bash
npm run verify:production
```

One command, exits nonzero on any failure. It:

1. Waits (up to 10 min, `--wait-timeout <seconds>` to change) for the latest
   production deployment to reach **Ready**; a terminal `ERROR`/`CANCELED`
   state fails immediately.
2. Probes key pages on the production domain:
   - `/` → 200
   - `/auth/login` → 200
   - `/dashboard` → 307 redirect to `/auth/login` (unauthenticated)
   - `/settings/connections` → 307 redirect (unauthenticated)
3. Scans the last 15 minutes of production runtime logs for `error`/`fatal`
   entries (the probes themselves generate fresh traffic).

Requires the Vercel CLI to be installed and logged in (`vercel whoami` →
`vmalafa`) with the repo linked (`.vercel/project.json` present).

## Roll back a bad deployment

On failure the verifier prints the exact command, targeting the newest
previous **Ready** production deployment, e.g.:

```bash
vercel rollback dpl_XXXXXXXXXXXX --scope vmalafas-projects --yes
```

If you need to find the target yourself:

```bash
vercel ls big-time --prod          # list production deployments, newest first
vercel rollback <deploymentId>     # roll back to that deployment
vercel rollback status             # watch the rollback progress
```

Rollback repoints the production alias to the previous build — it does not
revert `main`. Afterwards:

1. Re-run `npm run verify:production` to confirm production is healthy again.
2. Fix or revert the offending commit on `main` — the next push replaces the
   rolled-back deployment.

## Notes for the AFK loop

- Run `npm run verify:production` after **every** push to `main`.
- If production is broken and one fix-forward attempt fails: roll back, then
  comment findings on the issue being worked and move on.
