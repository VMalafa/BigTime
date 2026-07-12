// Provider-agnostic aggregator interface (ADR-0001).
//
// Everything downstream (sync, mapping, UI) depends only on these
// provider-neutral shapes. Swapping SimpleFIN for Teller/Plaid means one new
// class implementing AggregatorProvider — no schema or consumer changes.

export type FeedAccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "LOAN"
  | "INVESTMENT"
  | "OTHER";

export interface FeedAccount {
  externalId: string;
  name: string;
  institution: string;
  accountType: FeedAccountType;
  /** Provider-masked identifier only — never a full account number. */
  maskedNumber: string | null;
  balance: number;
  balanceAsOf: Date;
  currency: string;
}

export interface FeedTransactionRecord {
  externalId: string;
  accountExternalId: string;
  postedAt: Date;
  /** Signed; negative = money out. */
  amount: number;
  description: string;
  pending: boolean;
}

export interface FeedSnapshot {
  accounts: FeedAccount[];
  transactions: FeedTransactionRecord[];
  /** Provider-reported, human-readable problems (e.g. an institution needing attention). */
  warnings: string[];
}

/** Raised for problems the household can act on (bad token, revoked access). */
export class AggregatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AggregatorError";
  }
}

export interface AggregatorProvider {
  /** Exchange a user-supplied setup token for a long-lived access secret. */
  claim(setupToken: string): Promise<{ accessSecret: string }>;
  /** Fetch all accounts + transactions since `since` using the access secret. */
  fetchAccounts(accessSecret: string, since?: Date): Promise<FeedSnapshot>;
}
