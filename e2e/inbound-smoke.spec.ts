import { expect, test } from "@playwright/test";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";

loadDotEnv();

// The email mouth (#69), exercised with recorded Postmark payloads — the
// route-handlers-with-recorded-payloads seam from #91. The `.ics` and
// parked paths are deterministic (no AI call); the AI extraction paths are
// pinned at the unit seam (validation + tiering).
test.skip(
  process.env.E2E_SEED_FIXTURE !== "1",
  "Inbound smoke needs the seeded fixture household: run with E2E_SEED_FIXTURE=1."
);
test.skip(
  !process.env.POSTMARK_INBOUND_SECRET,
  "Inbound smoke needs POSTMARK_INBOUND_SECRET in .env (see docs/runbooks/postmark-inbound.md)."
);

const ROUTE = "/api/inbound/postmark";
const secret = () => process.env.POSTMARK_INBOUND_SECRET!;

const INBOUND_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//E2E//Inbound//EN",
  "X-WR-CALNAME:E2E Inbound School",
  "BEGIN:VEVENT",
  "UID:e2e-inbound-1@test",
  "DTSTART;VALUE=DATE:20270312",
  "DTEND;VALUE=DATE:20270313",
  "SUMMARY:E2E Inbound Book Fair",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:e2e-inbound-2@test",
  "DTSTART;VALUE=DATE:20270318",
  "DTEND;VALUE=DATE:20270319",
  "SUMMARY:E2E Inbound Noon Dismissal",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

function icsPayload(messageId: string) {
  return {
    MessageID: messageId,
    From: "office@e2e-school.example",
    FromFull: { Email: "office@e2e-school.example", Name: "E2E School Office" },
    Subject: "Calendar attached",
    TextBody: "This year's calendar is attached.",
    Date: "2026-07-18T12:00:00Z",
    Attachments: [
      {
        Name: "calendar.ics",
        Content: Buffer.from(INBOUND_ICS, "utf8").toString("base64"),
        ContentType: "text/calendar",
        ContentLength: INBOUND_ICS.length,
      },
    ],
  };
}

test("recorded payloads: unsigned rejected; .ics drafts + re-import dedup; unknown sender parks visibly", async ({
  page,
  request,
}) => {
  const stamp = Date.now();

  // --- Foreign posts bounce: no secret, wrong secret, junk body.
  expect((await request.post(ROUTE, { data: icsPayload(`e2e-${stamp}-x`) })).status()).toBe(401);
  expect(
    (
      await request.post(`${ROUTE}?secret=wrong`, {
        data: icsPayload(`e2e-${stamp}-x`),
      })
    ).status()
  ).toBe(401);
  expect(
    (
      await request.post(`${ROUTE}?secret=${encodeURIComponent(secret())}`, {
        data: { nope: true },
      })
    ).status()
  ).toBe(400);

  // --- A forwarded email with an .ics attachment rides the deterministic
  // path into DRAFT Events.
  const first = await request.post(
    `${ROUTE}?secret=${encodeURIComponent(secret())}`,
    { data: icsPayload(`e2e-${stamp}-ics`) }
  );
  expect(first.status()).toBe(200);
  expect(await first.json()).toMatchObject({
    ok: true,
    status: "PROCESSED",
    eventsCreated: 2,
  });

  // Webhook retry (same MessageID): acknowledged, not reprocessed.
  const retry = await request.post(
    `${ROUTE}?secret=${encodeURIComponent(secret())}`,
    { data: icsPayload(`e2e-${stamp}-ics`) }
  );
  expect(await retry.json()).toMatchObject({ ok: true, retried: true });

  // Reissue (new MessageID, same events): natural-key dedup raises nothing.
  const reissue = await request.post(
    `${ROUTE}?secret=${encodeURIComponent(secret())}`,
    { data: icsPayload(`e2e-${stamp}-ics2`) }
  );
  expect(await reissue.json()).toMatchObject({
    ok: true,
    status: "PROCESSED",
    eventsCreated: 0,
  });

  // --- An unreadable email from an unknown sender parks. Nothing dropped.
  const parked = await request.post(
    `${ROUTE}?secret=${encodeURIComponent(secret())}`,
    {
      data: {
        MessageID: `e2e-${stamp}-junk`,
        From: "mystery@nowhere.example",
        Subject: "FWD: (empty)",
      },
    }
  );
  expect(await parked.json()).toMatchObject({ ok: true, status: "PARKED" });

  // --- The review surface shows both: drafts to ratify, and the honest
  // forwarded-email ledger with the parked row's plain-language note.
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  await page.goto("/dashboard/calendar");
  await expect(
    page.getByRole("region", { name: "E2E Inbound School" })
  ).toBeVisible({ timeout: 20_000 });

  const ledger = page.locator("[data-inbound-status]");
  await expect(ledger.first()).toBeVisible();
  await expect(
    page.locator("[data-inbound-status='parked']").first()
  ).toContainText("nothing was dropped");
});

// The active provider (CloudMailin JSON-Normalized) rides the same spine
// through its own normalizer — recorded payload, deterministic paths.
test("cloudmailin payloads: normalized .ics drafts and parked unknowns", async ({
  request,
}) => {
  const stamp = Date.now();
  const cmRoute = "/api/inbound/cloudmailin";

  expect(
    (
      await request.post(cmRoute, {
        data: { headers: { message_id: `<cm-${stamp}@x>`, from: "a@b.c" } },
      })
    ).status()
  ).toBe(401);

  const withIcs = {
    envelope: { from: "office@e2e-school.example", to: "x@cloudmailin.net" },
    headers: {
      from: '"E2E School Office" <office@e2e-school.example>',
      subject: "Calendar attached",
      message_id: `<cm-${stamp}-ics@e2e>`,
      date: "Sat, 18 Jul 2026 12:00:00 +0000",
    },
    plain: "This year's calendar is attached.",
    attachments: [
      {
        file_name: "calendar.ics",
        content: Buffer.from(INBOUND_ICS, "utf8").toString("base64"),
        content_type: "text/calendar",
        size: INBOUND_ICS.length,
        disposition: "attachment",
      },
    ],
  };
  // Same school calendar as the Postmark case above (which ran first and
  // created the drafts): the natural-key dedup reaches across providers,
  // so this raises nothing new — proof it's one spine.
  const response = await request.post(
    `${cmRoute}?secret=${encodeURIComponent(secret())}`,
    { data: withIcs }
  );
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    ok: true,
    status: "PROCESSED",
    eventsCreated: 0,
  });

  // Unknown empty sender parks — same honest ledger.
  const parked = await request.post(
    `${cmRoute}?secret=${encodeURIComponent(secret())}`,
    {
      data: {
        envelope: { from: "mystery@nowhere.example" },
        headers: {
          from: "mystery@nowhere.example",
          subject: "FWD: (empty)",
          message_id: `<cm-${stamp}-junk@e2e>`,
        },
      },
    }
  );
  expect(await parked.json()).toMatchObject({ ok: true, status: "PARKED" });
});
