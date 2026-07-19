import { describe, expect, it } from "vitest";
import {
  emailSourceName,
  extractableText,
  htmlToText,
  pickIcsAttachments,
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
