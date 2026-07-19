import { describe, expect, it } from "vitest";
import { validateRenewalExtraction } from "@/lib/ingestion/renewal";

describe("validateRenewalExtraction", () => {
  it("accepts a well-formed notice", () => {
    const result = validateRenewalExtraction({
      notices: [
        {
          provider: "Acme Insurance",
          renewalDate: "2026-09-01",
          amountCents: 128_500,
          actionRequired: true,
          note: "Sign and return by Aug 15.",
        },
      ],
    });
    expect(result.notices).toHaveLength(1);
    expect(result.rejected).toBe(0);
    expect(result.notices[0]).toMatchObject({
      provider: "Acme Insurance",
      renewalDate: "2026-09-01",
      amountCents: 128_500,
      actionRequired: true,
    });
  });

  it("amount is optional — the ambiguous-premium failure mode omits it", () => {
    const result = validateRenewalExtraction({
      notices: [
        {
          provider: "Acme",
          renewalDate: "2026-09-01",
          actionRequired: false,
        },
      ],
    });
    expect(result.notices[0].amountCents).toBeUndefined();
  });

  it("rejects (and counts) invalid rows instead of dropping silently", () => {
    const result = validateRenewalExtraction({
      notices: [
        { provider: "", renewalDate: "2026-09-01", actionRequired: true },
        { provider: "A", renewalDate: "Sept 1", actionRequired: true },
        { provider: "B", renewalDate: "2026-02-31", actionRequired: true },
        { provider: "C", renewalDate: "2026-09-01", actionRequired: "yes" },
        { provider: "D", renewalDate: "2026-09-01", actionRequired: true, amountCents: 12.5 },
        "junk",
        { provider: "OK", renewalDate: "2026-09-01", actionRequired: true },
      ],
    });
    expect(result.notices.map((n) => n.provider)).toEqual(["OK"]);
    expect(result.rejected).toBe(6);
  });

  it("handles garbage input shapes", () => {
    expect(validateRenewalExtraction(null)).toEqual({ notices: [], rejected: 0 });
    expect(validateRenewalExtraction({})).toEqual({ notices: [], rejected: 0 });
    expect(validateRenewalExtraction({ notices: "x" })).toEqual({
      notices: [],
      rejected: 0,
    });
  });
});
