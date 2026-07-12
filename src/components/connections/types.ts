// Plain serializable shapes passed from the connections server page into
// client components. Bank data lives ONLY in server components and transient
// client props/state — never in the Zustand persisted store or localStorage.

export interface AccountView {
  id: string;
  name: string;
  institution: string;
  accountType: string;
  maskedNumber: string | null;
  currentBalance: number;
  balanceAsOf: string; // ISO
  currency: string;
  profileId: string | null;
  mappedDebt: { id: string; name: string } | null;
  mappable: boolean;
}

export interface ConnectionView {
  id: string;
  status: "ACTIVE" | "ERROR" | "REVOKED";
  lastSyncAt: string | null; // ISO
  lastSyncError: string | null;
  accounts: AccountView[];
}

export interface ProfileOption {
  id: string;
  name: string;
}

export interface DebtCandidate {
  id: string;
  name: string;
  balance: number;
  debtType: string;
}
