import { describe, expect, it } from "vitest";
import {
  emailSourceName,
  extractableText,
  htmlToText,
  parseAddress,
  pickIcsAttachments,
  validateCloudMailinPayload,
  validateInboundPayload,
  verifyInboundSecret,
  type InboundPayload,
} from "@/lib/ingestion/inbound";

function payload(overrides: Partial<InboundPayload> = {}): InboundPayload {
  return {
    MessageID: "msg-1",
    From: "news@resources.finalsite.net",
    FromFull: { Email: "news@resources.finalsite.net", Name: "Corbett Prep" },
    Subject: "This Week at Corbett",
    ...overrides,
  };
}

describe("validateInboundPayload", () => {
  it("accepts the Postmark shape", () => {
    expect(validateInboundPayload(payload())).not.toBeNull();
  });

  it("rejects non-objects and missing keys", () => {
    expect(validateInboundPayload(null)).toBeNull();
    expect(validateInboundPayload("x")).toBeNull();
    expect(validateInboundPayload({})).toBeNull();
    expect(validateInboundPayload({ MessageID: "", From: "a", Subject: "b" })).toBeNull();
    expect(validateInboundPayload({ MessageID: "m", Subject: "b" })).toBeNull();
  });
});

describe("parseAddress", () => {
  it("splits display-name forms and passes bare addresses through", () => {
    expect(parseAddress('"Corbett Prep" <news@finalsite.net>')).toEqual({
      email: "news@finalsite.net",
      name: "Corbett Prep",
    });
    expect(parseAddress("Corbett Prep <news@finalsite.net>")).toEqual({
      email: "news@finalsite.net",
      name: "Corbett Prep",
    });
    expect(parseAddress("news@finalsite.net")).toEqual({
      email: "news@finalsite.net",
    });
  });
});

describe("validateCloudMailinPayload", () => {
  const cloudmailin = {
    envelope: { from: "news@resources.finalsite.net", to: "x@cloudmailin.net" },
    headers: {
      from: '"Corbett Prep" <news@resources.finalsite.net>',
      subject: "This Week at Corbett",
      message_id: "<abc123@mail.finalsite.net>",
      date: "Sat, 18 Jul 2026 12:00:00 +0000",
    },
    plain: "Spirit Week Thurs. 13 & Fri. 14",
    html: "<p>Spirit Week</p>",
    attachments: [
      {
        file_name: "cal.ics",
        content: "QkVHSU46VkNBTEVOREFS",
        content_type: "text/calendar",
        size: 20,
        disposition: "attachment",
      },
    ],
  };

  it("normalizes to the spine's payload shape", () => {
    const p = validateCloudMailinPayload(cloudmailin);
    expect(p).toMatchObject({
      MessageID: "<abc123@mail.finalsite.net>",
      From: "news@resources.finalsite.net",
      FromFull: {
        Email: "news@resources.finalsite.net",
        Name: "Corbett Prep",
      },
      Subject: "This Week at Corbett",
      TextBody: "Spirit Week Thurs. 13 & Fri. 14",
    });
    expect(p!.Attachments).toEqual([
      {
        Name: "cal.ics",
        Content: "QkVHSU46VkNBTEVOREFS",
        ContentType: "text/calendar",
        ContentLength: 20,
      },
    ]);
    // The normalized payload rides the same downstream helpers.
    expect(emailSourceName(p!)).toBe("Corbett Prep");
    expect(pickIcsAttachments(p!)).toHaveLength(1);
  });

  it("carries URL-mode attachments without content (no .ics ride)", () => {
    const p = validateCloudMailinPayload({
      ...cloudmailin,
      attachments: [
        {
          file_name: "cal.ics",
          url: "https://store.example/cal.ics",
          content_type: "text/calendar",
          size: 20,
        },
      ],
    });
    expect(p!.Attachments![0].Content).toBe("");
  });

  it("rejects payloads without a message id or sender", () => {
    expect(
      validateCloudMailinPayload({ ...cloudmailin, headers: { from: "a@b" } })
    ).toBeNull();
    expect(
      validateCloudMailinPayload({
        headers: { message_id: "<x@y>", subject: "s" },
        envelope: {},
      })
    ).toBeNull();
    expect(validateCloudMailinPayload(null)).toBeNull();
    expect(validateCloudMailinPayload({ Postmark: true })).toBeNull();
  });
});

describe("verifyInboundSecret", () => {
  it("accepts only the exact secret", () => {
    expect(verifyInboundSecret("s3cret", "s3cret")).toBe(true);
    expect(verifyInboundSecret("wrong", "s3cret")).toBe(false);
    expect(verifyInboundSecret("", "s3cret")).toBe(false);
    expect(verifyInboundSecret(null, "s3cret")).toBe(false);
  });

  it("fails closed when the deployment has no secret", () => {
    expect(verifyInboundSecret("anything", undefined)).toBe(false);
    expect(verifyInboundSecret("anything", "")).toBe(false);
  });
});

describe("pickIcsAttachments", () => {
  it("selects by extension or content type", () => {
    const p = payload({
      Attachments: [
        { Name: "cal.ics", Content: "", ContentType: "application/octet-stream", ContentLength: 1 },
        { Name: "invite", Content: "", ContentType: "text/calendar; charset=utf-8", ContentLength: 1 },
        { Name: "photo.png", Content: "", ContentType: "image/png", ContentLength: 1 },
      ],
    });
    expect(pickIcsAttachments(p).map((a) => a.Name)).toEqual([
      "cal.ics",
      "invite",
    ]);
  });

  it("handles missing attachments", () => {
    expect(pickIcsAttachments(payload())).toEqual([]);
  });
});

describe("emailSourceName", () => {
  it("prefers the sender's display name — stable across reissues", () => {
    expect(emailSourceName(payload())).toBe("Corbett Prep");
  });

  it("falls back to the sender domain", () => {
    expect(
      emailSourceName(payload({ FromFull: { Email: "a@school.org" } }))
    ).toBe("school.org");
    expect(
      emailSourceName(payload({ FromFull: undefined, From: "x@y.co" }))
    ).toBe("y.co");
  });
});

describe("htmlToText / extractableText", () => {
  it("strips markup and entities, keeps the words", () => {
    const text = htmlToText(
      "<div><h1>Spirit Week</h1><p>Thurs. 13 &amp; Fri. 14</p><style>p{}</style></div>"
    );
    expect(text).toContain("Spirit Week");
    expect(text).toContain("Thurs. 13 & Fri. 14");
    expect(text).not.toContain("<");
  });

  it("prefers TextBody, falls back to HtmlBody, else empty", () => {
    expect(extractableText(payload({ TextBody: "plain" }))).toBe("plain");
    expect(
      extractableText(payload({ HtmlBody: "<p>rich</p>" }))
    ).toBe("rich");
    expect(extractableText(payload())).toBe("");
  });
});
