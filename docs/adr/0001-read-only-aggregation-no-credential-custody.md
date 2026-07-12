# Read-only bank aggregation via SimpleFIN; the app never stores bank credentials

The original vision for the aggregation feature included a built-in credential manager storing usernames/passwords for banks and credit cards. We decided the app will **never hold bank credentials in any form**. Account linking happens through SimpleFIN Bridge, which is read-only by design: the user authenticates at their institution, and the app stores only a revocable, read-only access token. Actual passwords live in a dedicated password manager (1Password/Bitwarden), not here.

## Considered Options

- **Encrypted credential vault in-app** — rejected: retrievable secrets mean one leaked key exposes every banking credential; likely violates bank ToS and can void fraud protection; a household app cannot match the security engineering of dedicated password managers.
- **Plaid** — rejected for now: broadest coverage, but production access is a sales-led business process, poor fit for a single-household deployment.
- **Teller** — viable fallback: free dev tier, reliable direct integrations, narrower coverage.
- **SimpleFIN Bridge** — chosen: ~$15/year, read-only by design, daily refresh, personal-use friendly.

## Consequences

- SimpleFIN is wrapped behind a thin provider interface so Teller/Plaid can be substituted if institution coverage fails.
- Data freshness is bounded at roughly daily; the product must be designed around "as of yesterday" data, not real-time balances.
- The app's scope is insight, not custody of secrets.
