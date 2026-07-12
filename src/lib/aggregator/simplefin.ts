import {
  AggregatorError,
  type AggregatorProvider,
  type FeedAccount,
  type FeedAccountType,
  type FeedSnapshot,
  type FeedTransactionRecord,
} from "./provider.ts"; // extension: this module is also loaded directly by `node --test`

// SimpleFIN Bridge provider (ADR-0001).
//
// All SimpleFIN specifics live here: base64 setup tokens that decode to a
// claim URL, an access URL that embeds Basic-auth credentials (the access URL
// IS the secret), and the /accounts endpoint. Nothing outside this file
// depends on any of it.

const REQUEST_TIMEOUT_MS = 30_000;

interface SimpleFinOrg {
  name?: string;
  domain?: string;
  "sfin-url"?: string;
}

interface SimpleFinTransaction {
  id: string;
  posted: number; // unix seconds; may be 0 for pending transactions
  amount: string; // signed decimal string
  description: string;
  transacted_at?: number;
  pending?: boolean;
}

interface SimpleFinAccount {
  org?: SimpleFinOrg;
  id: string;
  name: string;
  currency: string;
  balance: string; // decimal string
  "available-balance"?: string;
  "balance-date": number; // unix seconds
  transactions?: SimpleFinTransaction[];
}

interface SimpleFinAccountSet {
  errors?: string[];
  accounts?: SimpleFinAccount[];
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * SimpleFIN gives no structured account type, so infer one from the account
 * name, falling back to CREDIT_CARD for unnamed negative-balance accounts
 * (liabilities are what mapping cares about).
 */
export function inferAccountType(name: string, balance: number): FeedAccountType {
  const n = name.toLowerCase();
  if (/credit|card|visa|mastercard|amex|discover/.test(n)) return "CREDIT_CARD";
  if (/mortgage|loan|financing/.test(n)) return "LOAN";
  if (/saving|money market|\bmma\b|\bcd\b/.test(n)) return "SAVINGS";
  if (/check|debit|spending|cash management/.test(n)) return "CHECKING";
  if (/invest|brokerage|401|\bira\b|roth|hsa/.test(n)) return "INVESTMENT";
  if (balance < 0) return "CREDIT_CARD";
  return "OTHER";
}

/**
 * Some institutions suffix account names with a masked number ("Checking
 * ****1234"). Extract it when it's unambiguously masked; store nothing
 * otherwise — full account numbers must never enter the system.
 */
export function extractMaskedNumber(name: string): string | null {
  const match = name.match(/(?:\*{2,}|x{2,}|…|\.{3})\s*(\d{2,4})\s*$/i);
  return match ? `···${match[1]}` : null;
}

function parseAmount(value: string, context: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AggregatorError(`SimpleFIN returned an unreadable amount for ${context}.`);
  }
  return parsed;
}

function toDate(unixSeconds: number): Date {
  return new Date(unixSeconds * 1000);
}

export class SimpleFinProvider implements AggregatorProvider {
  async claim(setupToken: string): Promise<{ accessSecret: string }> {
    let claimUrl: string;
    try {
      claimUrl = Buffer.from(setupToken.trim(), "base64").toString("utf8");
    } catch {
      claimUrl = "";
    }
    if (!/^https?:\/\//.test(claimUrl)) {
      throw new AggregatorError(
        "That doesn't look like a SimpleFIN setup token. Copy the whole token from SimpleFIN Bridge and try again."
      );
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(claimUrl, {
        method: "POST",
        headers: { "Content-Length": "0" },
      });
    } catch {
      throw new AggregatorError(
        "Couldn't reach SimpleFIN Bridge to claim the token. Please try again in a minute."
      );
    }

    if (!response.ok) {
      throw new AggregatorError(
        "SimpleFIN rejected this setup token — it may be expired or already claimed. Generate a fresh one at SimpleFIN Bridge."
      );
    }

    const accessSecret = (await response.text()).trim();
    let parsed: URL;
    try {
      parsed = new URL(accessSecret);
    } catch {
      throw new AggregatorError(
        "SimpleFIN returned an unexpected response while claiming the token. Please try again."
      );
    }
    if (!parsed.username) {
      throw new AggregatorError(
        "SimpleFIN returned an access URL without credentials. Please generate a new setup token."
      );
    }

    return { accessSecret };
  }

  async fetchAccounts(accessSecret: string, since?: Date): Promise<FeedSnapshot> {
    const accessUrl = new URL(accessSecret);
    const { username, password } = accessUrl;
    accessUrl.username = "";
    accessUrl.password = "";

    const endpoint = new URL(
      `${accessUrl.pathname.replace(/\/$/, "")}/accounts`,
      accessUrl.origin
    );
    endpoint.searchParams.set("pending", "1");
    if (since) {
      endpoint.searchParams.set(
        "start-date",
        String(Math.floor(since.getTime() / 1000))
      );
    }

    const basicAuth = Buffer.from(
      `${decodeURIComponent(username)}:${decodeURIComponent(password)}`
    ).toString("base64");

    let response: Response;
    try {
      response = await fetchWithTimeout(endpoint.toString(), {
        headers: { Authorization: `Basic ${basicAuth}` },
      });
    } catch {
      throw new AggregatorError(
        "Couldn't reach SimpleFIN Bridge. Please try again in a minute."
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new AggregatorError(
        "SimpleFIN no longer accepts this connection's access token — it may have been revoked. Re-link to restore syncing."
      );
    }
    if (!response.ok) {
      throw new AggregatorError(
        `SimpleFIN Bridge returned an error (HTTP ${response.status}). Please try again later.`
      );
    }

    let payload: SimpleFinAccountSet;
    try {
      payload = (await response.json()) as SimpleFinAccountSet;
    } catch {
      throw new AggregatorError(
        "SimpleFIN Bridge returned an unreadable response. Please try again later."
      );
    }

    const accounts: FeedAccount[] = [];
    const transactions: FeedTransactionRecord[] = [];

    for (const account of payload.accounts ?? []) {
      const balance = parseAmount(account.balance, `account "${account.name}"`);
      accounts.push({
        externalId: account.id,
        name: account.name,
        institution: account.org?.name ?? account.org?.domain ?? "Unknown institution",
        accountType: inferAccountType(account.name, balance),
        maskedNumber: extractMaskedNumber(account.name),
        balance,
        balanceAsOf: toDate(account["balance-date"]),
        currency: account.currency || "USD",
      });

      for (const transaction of account.transactions ?? []) {
        // Pending transactions may report posted = 0; fall back to the
        // transaction date so ordering stays sane.
        const postedSeconds = transaction.posted || transaction.transacted_at;
        if (!postedSeconds) continue;
        transactions.push({
          externalId: transaction.id,
          accountExternalId: account.id,
          postedAt: toDate(postedSeconds),
          amount: parseAmount(transaction.amount, `transaction "${transaction.id}"`),
          description: transaction.description,
          pending: transaction.pending ?? false,
        });
      }
    }

    return { accounts, transactions, warnings: payload.errors ?? [] };
  }
}

/** The active provider. Swap here (or make it configurable) to change aggregators. */
export function getAggregatorProvider(): AggregatorProvider {
  return new SimpleFinProvider();
}

export const AGGREGATOR_PROVIDER_NAME = "SIMPLEFIN";
