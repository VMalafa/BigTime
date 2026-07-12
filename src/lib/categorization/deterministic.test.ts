import { describe, expect, it } from "vitest";
import {
  TRANSFER_PAIRING_WINDOW_MS,
  categorizeByFixedCostLineItem,
  categorizeByMappedDebt,
  categorizeByRule,
  categorizeTransaction,
  isInstallmentDebtType,
  normalizeMerchant,
  pairTransfers,
  type AccountContext,
  type TransactionInput,
} from "./deterministic.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

function account(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    id: overrides.id ?? "acct-checking",
    accountType: "CHECKING",
    mappedDebtType: null,
    ...overrides,
  };
}

function txn(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    id: overrides.id ?? `txn-${Math.random()}`,
    linkedAccountId: "acct-checking",
    amountCents: -1000,
    postedAt: new Date("2026-07-01T00:00:00Z"),
    description: "Merchant",
    cspBucket: "UNCATEGORIZED",
    isTransfer: false,
    transferPairId: null,
    ...overrides,
  };
}

function accountsMap(...accounts: AccountContext[]) {
  return new Map(accounts.map((a) => [a.id, a]));
}

describe("normalizeMerchant", () => {
  it("uppercases and collapses punctuation and digits", () => {
    expect(normalizeMerchant("SQ *COFFEE 4821")).toBe("SQ COFFEE");
    expect(normalizeMerchant("Netflix.com  #123")).toBe("NETFLIX COM");
    expect(normalizeMerchant("   ")).toBe("");
  });
});

describe("pairTransfers — credit-card payment scenario", () => {
  const checking = account({ id: "acct-checking" });
  const card = account({
    id: "acct-card",
    accountType: "CREDIT_CARD",
    mappedDebtType: "CREDIT_CARD",
  });

  it("pairs the checking debit with the card credit posting two days later", () => {
    const outLeg = txn({
      id: "out",
      linkedAccountId: "acct-checking",
      amountCents: -50000,
      postedAt: new Date("2026-07-01T00:00:00Z"),
      description: "Payment to Chase card",
    });
    const inLeg = txn({
      id: "in",
      linkedAccountId: "acct-card",
      amountCents: 50000,
      postedAt: new Date("2026-07-03T00:00:00Z"),
      description: "Payment received - thank you",
    });

    const pairs = pairTransfers([outLeg, inLeg], accountsMap(checking, card));
    expect(pairs).toEqual([{ outLegId: "out", inLegId: "in", kind: "TRANSFER" }]);
  });

  it("pairs inside the tolerance window but not beyond it", () => {
    const outLeg = txn({
      id: "out",
      amountCents: -50000,
      postedAt: new Date("2026-07-01T00:00:00Z"),
    });
    const inLegAtEdge = txn({
      id: "in-edge",
      linkedAccountId: "acct-card",
      amountCents: 50000,
      postedAt: new Date(outLeg.postedAt.getTime() + TRANSFER_PAIRING_WINDOW_MS),
    });
    expect(
      pairTransfers([outLeg, inLegAtEdge], accountsMap(checking, card))
    ).toHaveLength(1);

    const inLegBeyond = txn({
      id: "in-beyond",
      linkedAccountId: "acct-card",
      amountCents: 50000,
      postedAt: new Date(
        outLeg.postedAt.getTime() + TRANSFER_PAIRING_WINDOW_MS + 1
      ),
    });
    expect(
      pairTransfers([outLeg, inLegBeyond], accountsMap(checking, card))
    ).toHaveLength(0);
  });

  it("never pairs legs on the same account, different amounts, or zero", () => {
    const map = accountsMap(checking, card);
    expect(
      pairTransfers(
        [
          txn({ id: "a", amountCents: -50000 }),
          txn({ id: "b", amountCents: 50000 }), // same account
        ],
        map
      )
    ).toHaveLength(0);
    expect(
      pairTransfers(
        [
          txn({ id: "a", amountCents: -50000 }),
          txn({ id: "b", linkedAccountId: "acct-card", amountCents: 49999 }),
        ],
        map
      )
    ).toHaveLength(0);
    expect(
      pairTransfers(
        [
          txn({ id: "a", amountCents: 0 }),
          txn({ id: "b", linkedAccountId: "acct-card", amountCents: 0 }),
        ],
        map
      )
    ).toHaveLength(0);
  });

  it("prefers the nearest-in-time candidate and pairs each leg once", () => {
    const outLeg = txn({
      id: "out",
      amountCents: -50000,
      postedAt: new Date("2026-07-05T00:00:00Z"),
    });
    const near = txn({
      id: "near",
      linkedAccountId: "acct-card",
      amountCents: 50000,
      postedAt: new Date("2026-07-06T00:00:00Z"),
    });
    const far = txn({
      id: "far",
      linkedAccountId: "acct-card",
      amountCents: 50000,
      postedAt: new Date("2026-07-08T00:00:00Z"),
    });

    const pairs = pairTransfers([outLeg, near, far], accountsMap(checking, card));
    expect(pairs).toHaveLength(1);
    expect(pairs[0].inLegId).toBe("near");
  });

  it("skips transactions that are already paired", () => {
    const outLeg = txn({ id: "out", amountCents: -50000, transferPairId: "x" });
    const inLeg = txn({
      id: "in",
      linkedAccountId: "acct-card",
      amountCents: 50000,
    });
    expect(
      pairTransfers([outLeg, inLeg], accountsMap(checking, card))
    ).toHaveLength(0);
  });

  it("marks payments into an installment mapped-debt account as INSTALLMENT_PAYMENT", () => {
    const mortgage = account({
      id: "acct-mortgage",
      accountType: "LOAN",
      mappedDebtType: "MORTGAGE",
    });
    const outLeg = txn({ id: "out", amountCents: -120000 });
    const inLeg = txn({
      id: "in",
      linkedAccountId: "acct-mortgage",
      amountCents: 120000,
      postedAt: new Date("2026-07-02T00:00:00Z"),
    });

    const pairs = pairTransfers([outLeg, inLeg], accountsMap(checking, mortgage));
    expect(pairs).toEqual([
      { outLegId: "out", inLegId: "in", kind: "INSTALLMENT_PAYMENT" },
    ]);
  });
});

describe("categorizeByMappedDebt", () => {
  it("categorizes installment mapped-debt accounts as Fixed Costs / Debt Minimums", () => {
    const result = categorizeByMappedDebt(
      account({ id: "loan", accountType: "LOAN", mappedDebtType: "AUTO_LOAN" })
    );
    expect(result).toEqual({
      cspBucket: "FIXED_COSTS",
      moneyDial: null,
      fixedCostCategory: "DEBT_MINIMUMS",
      source: "MAPPED_DEBT",
    });
  });

  it("does not categorize revolving or unmapped accounts", () => {
    expect(
      categorizeByMappedDebt(
        account({ accountType: "CREDIT_CARD", mappedDebtType: "CREDIT_CARD" })
      )
    ).toBeNull();
    expect(categorizeByMappedDebt(account())).toBeNull();
    expect(isInstallmentDebtType("CREDIT_CARD")).toBe(false);
    expect(isInstallmentDebtType("MORTGAGE")).toBe(true);
  });
});

describe("categorizeByFixedCostLineItem", () => {
  const lineItems = [
    { name: "Netflix", category: "SUBSCRIPTIONS" },
    { name: "State Farm Insurance", category: "INSURANCE" },
  ];

  it("matches a money-out transaction whose description contains the item name", () => {
    const result = categorizeByFixedCostLineItem(
      txn({ description: "NETFLIX.COM 866-579-7172", amountCents: -1549 }),
      lineItems
    );
    expect(result).toEqual({
      cspBucket: "FIXED_COSTS",
      moneyDial: null,
      fixedCostCategory: "SUBSCRIPTIONS",
      source: "FIXED_COST_MATCH",
    });
  });

  it("never matches deposits or unrelated descriptions", () => {
    expect(
      categorizeByFixedCostLineItem(
        txn({ description: "NETFLIX REFUND", amountCents: 1549 }),
        lineItems
      )
    ).toBeNull();
    expect(
      categorizeByFixedCostLineItem(txn({ description: "SQ *COFFEE" }), lineItems)
    ).toBeNull();
  });
});

describe("categorizeByRule", () => {
  const rules = [
    {
      merchantPattern: "SQ COFFEE",
      cspBucket: "GUILT_FREE" as const,
      moneyDial: "FOOD_DINING",
      fixedCostCategory: null,
    },
  ];

  it("applies the first matching rule's two-level Categorization", () => {
    const result = categorizeByRule(
      txn({ description: "SQ *COFFEE 4821 SEATTLE" }),
      rules
    );
    expect(result).toEqual({
      cspBucket: "GUILT_FREE",
      moneyDial: "FOOD_DINING",
      fixedCostCategory: null,
      source: "RULE",
    });
  });

  it("returns null when no rule matches", () => {
    expect(categorizeByRule(txn({ description: "SHELL OIL" }), rules)).toBeNull();
  });
});

describe("categorizeTransaction — layer order and eligibility", () => {
  const loanAccount = account({
    id: "loan",
    accountType: "LOAN",
    mappedDebtType: "STUDENT_LOAN",
  });
  const rules = [
    {
      merchantPattern: "NETFLIX",
      cspBucket: "GUILT_FREE" as const,
      moneyDial: "TECHNOLOGY",
      fixedCostCategory: null,
    },
  ];
  const lineItems = [{ name: "Netflix", category: "SUBSCRIPTIONS" }];

  it("mapped debt wins over line items and rules", () => {
    const result = categorizeTransaction(
      txn({ linkedAccountId: "loan", description: "NETFLIX" }),
      loanAccount,
      rules,
      lineItems
    );
    expect(result?.source).toBe("MAPPED_DEBT");
  });

  it("fixed-cost line items win over rules", () => {
    const result = categorizeTransaction(
      txn({ description: "NETFLIX.COM" }),
      account(),
      rules,
      lineItems
    );
    expect(result?.source).toBe("FIXED_COST_MATCH");
  });

  it("falls through to rules, then stays uncategorized", () => {
    const ruleHit = categorizeTransaction(
      txn({ description: "NETFLIX.COM", amountCents: 1549 }), // deposit: no line-item match
      account(),
      rules,
      []
    );
    expect(ruleHit?.source).toBe("RULE");

    expect(
      categorizeTransaction(txn({ description: "MYSTERY MERCHANT" }), account(), [], [])
    ).toBeNull();
  });

  it("never overwrites an existing Categorization or touches Transfers", () => {
    expect(
      categorizeTransaction(
        txn({ description: "NETFLIX", cspBucket: "GUILT_FREE" }),
        account(),
        rules,
        lineItems
      )
    ).toBeNull();
    expect(
      categorizeTransaction(
        txn({ description: "NETFLIX", isTransfer: true }),
        account(),
        rules,
        lineItems
      )
    ).toBeNull();
    expect(
      categorizeTransaction(
        txn({ description: "NETFLIX", transferPairId: "other" }),
        account(),
        rules,
        lineItems
      )
    ).toBeNull();
  });
});
