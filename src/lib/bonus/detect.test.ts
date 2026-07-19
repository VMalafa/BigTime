import { describe, expect, it } from "vitest";
import {
  detectBonusDeposits,
  typicalPaycheckCents,
  type BonusDepositInput,
} from "@/lib/bonus/detect";
import { detectRecurringPatterns } from "@/lib/recurring/pattern-engine";

const PAYROLL = "ACME CORP DES:PAYROLL 001";

function deposit(
  id: string,
  iso: string,
  amountCents: number,
  description: string,
  isTransfer = false
): BonusDepositInput {
  return { id, postedAt: new Date(iso), amountCents, description, isTransfer };
}

/** Six months of biweekly-ish paychecks so the recurring engine has rhythm. */
function paycheckHistory(): BonusDepositInput[] {
  const out: BonusDepositInput[] = [];
  for (let month = 1; month <= 6; month++) {
    const mm = String(month).padStart(2, "0");
    out.push(deposit(`pay-${month}a`, `2026-${mm}-01T12:00:00Z`, 275_000, PAYROLL));
    out.push(deposit(`pay-${month}b`, `2026-${mm}-15T12:00:00Z`, 275_000, PAYROLL));
  }
  return out;
}

function detect(deposits: BonusDepositInput[], typical = 275_000) {
  return detectBonusDeposits({
    deposits,
    confirmedStreamPatterns: [PAYROLL],
    recurringDepositPatterns: detectRecurringPatterns(deposits),
    typicalPaycheckCents: typical,
  });
}

describe("typicalPaycheckCents", () => {
  it("is the median deposit, robust to one odd check", () => {
    expect(typicalPaycheckCents([275_000, 275_000, 300_000])).toBe(275_000);
    expect(typicalPaycheckCents([200_000, 300_000])).toBe(250_000);
    expect(typicalPaycheckCents([])).toBe(0);
  });
});

describe("detectBonusDeposits", () => {
  it("raises exactly one Moment for a 0.6×-paycheck unknown deposit", () => {
    const bonus = deposit("bonus-1", "2026-06-20T12:00:00Z", 165_000, "SPOT AWARD PAYOUT");
    const candidates = detect([...paycheckHistory(), bonus]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].feedTransactionId).toBe("bonus-1");
    expect(candidates[0].amountCents).toBe(165_000);
  });

  it("stays silent for a 0.3× deposit — normal income categorization", () => {
    const small = deposit("small-1", "2026-06-20T12:00:00Z", 82_500, "TAX REFUND TREAS");
    expect(detect([...paycheckHistory(), small])).toHaveLength(0);
  });

  it("never fires on confirmed paycheck-pattern deposits, whatever the size", () => {
    const fatCheck = deposit("pay-extra", "2026-06-22T12:00:00Z", 550_000, PAYROLL);
    expect(detect([...paycheckHistory(), fatCheck])).toHaveLength(0);
  });

  it("never fires on an unconfirmed-but-recurring second stream (the partner's paycheck)", () => {
    const partner: BonusDepositInput[] = [];
    for (let month = 1; month <= 6; month++) {
      const mm = String(month).padStart(2, "0");
      partner.push(
        deposit(`p2-${month}`, `2026-${mm}-05T12:00:00Z`, 180_000, "GLOBEX PAYROLL DEP")
      );
    }
    expect(detect([...paycheckHistory(), ...partner])).toHaveLength(0);
  });

  it("ignores transfers even at windfall size", () => {
    const sweep = deposit("tx-1", "2026-06-20T12:00:00Z", 400_000, "SWEEP FROM SAVINGS", true);
    expect(detect([...paycheckHistory(), sweep])).toHaveLength(0);
  });

  it("does nothing without a typical paycheck to measure against", () => {
    const bonus = deposit("bonus-1", "2026-06-20T12:00:00Z", 165_000, "SPOT AWARD PAYOUT");
    expect(detect([bonus], 0)).toHaveLength(0);
  });

  it("returns multiple windfalls oldest first", () => {
    const first = deposit("b1", "2026-05-10T12:00:00Z", 200_000, "RELOCATION GROSSUP");
    const second = deposit("b2", "2026-06-20T12:00:00Z", 165_000, "SPOT AWARD PAYOUT");
    const candidates = detect([...paycheckHistory(), second, first]);
    expect(candidates.map((c) => c.feedTransactionId)).toEqual(["b1", "b2"]);
  });
});
