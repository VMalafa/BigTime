// Renewal-notice extraction (#69, surfaced by #70): the second draft type
// on the email spine — provider, renewal date, amount, action-required.
// Same structured-output pattern as the calendar extraction (#57): a tool
// schema the model must call, validated ruthlessly here.

export const RENEWAL_TOOL_NAME = "record_renewal_notices";

export const RENEWAL_TOOL = {
  name: RENEWAL_TOOL_NAME,
  description:
    "Record renewal or insurance notices found in an email: who it's from, when the renewal lands, what it costs, and whether the household must act.",
  input_schema: {
    type: "object" as const,
    properties: {
      notices: {
        type: "array",
        items: {
          type: "object",
          properties: {
            provider: {
              type: "string",
              description: "Company or plan the notice is about.",
            },
            renewalDate: {
              type: "string",
              description:
                "The renewal/effective/deadline date, YYYY-MM-DD. Omit the notice if no date is stated.",
            },
            amountCents: {
              type: "integer",
              description:
                "The NEW amount in cents when stated unambiguously; omit when the letter mixes old and new amounts unclearly.",
            },
            actionRequired: {
              type: "boolean",
              description:
                "true when the household must do something (re-enroll, sign, cancel by a date); false for pure auto-renew notices.",
            },
            note: {
              type: "string",
              description: "One plain sentence of context, if useful.",
            },
          },
          required: ["provider", "renewalDate", "actionRequired"],
        },
      },
    },
    required: ["notices"],
  },
};

export function buildRenewalSystemPrompt(todayIso: string): string {
  return [
    "You extract renewal and insurance notices from household emails.",
    `Today is ${todayIso}.`,
    "Record only notices with an explicit date. Never invent amounts: when a letter shows both an old and a new premium and the new one isn't unambiguous, omit amountCents.",
    "A marketing email with no renewal facts yields an empty notices array.",
  ].join(" ");
}

export interface RenewalNotice {
  provider: string;
  /** YYYY-MM-DD. */
  renewalDate: string;
  amountCents?: number;
  actionRequired: boolean;
  note?: string;
}

export interface RenewalExtraction {
  notices: RenewalNotice[];
  /** Rows the model produced that failed validation — reported, never
   * silently dropped (Honesty Rule). */
  rejected: number;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function validateRenewalExtraction(input: unknown): RenewalExtraction {
  const result: RenewalExtraction = { notices: [], rejected: 0 };
  if (typeof input !== "object" || input === null) return result;
  const raw = (input as { notices?: unknown }).notices;
  if (!Array.isArray(raw)) return result;

  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      result.rejected++;
      continue;
    }
    const n = item as Record<string, unknown>;
    const provider = typeof n.provider === "string" ? n.provider.trim() : "";
    const renewalDate =
      typeof n.renewalDate === "string" ? n.renewalDate.trim() : "";
    const actionRequired = typeof n.actionRequired === "boolean"
      ? n.actionRequired
      : null;
    const amountValid =
      n.amountCents === undefined ||
      (typeof n.amountCents === "number" &&
        Number.isInteger(n.amountCents) &&
        n.amountCents >= 0);

    if (
      provider === "" ||
      !isValidDate(renewalDate) ||
      actionRequired === null ||
      !amountValid
    ) {
      result.rejected++;
      continue;
    }
    result.notices.push({
      provider,
      renewalDate,
      actionRequired,
      amountCents: n.amountCents as number | undefined,
      note: typeof n.note === "string" && n.note.trim() ? n.note.trim() : undefined,
    });
  }
  return result;
}
