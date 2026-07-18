import { expect, test } from "@playwright/test";
import {
  E2E_SPENDING_EMAIL,
  e2eSpendingPassword,
  loadDotEnv,
} from "./fixture";
import {
  buildCorbettIcs,
  CORBETT_EVENTS,
  CORBETT_MULTI_DAY_COUNT,
  CORBETT_SINGLE_DAY_COUNT,
} from "./corbett-fixture";

loadDotEnv();

// Calendar ingestion v1 (#55) against the ground-truth Corbett export:
// tiered ratification, natural-key re-import dedup, remembered dismissals,
// and ceremony-free manual entry. Needs the seeded fixture household
// (global-setup resets its Calendar Sources each seeded run).
test.skip(
  process.env.E2E_SEED_FIXTURE !== "1",
  "Calendar smoke needs the seeded fixture household: run with E2E_SEED_FIXTURE=1 (writes an isolated e2e-spending-* household to the shared DB)."
);

test.beforeEach(async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(E2E_SPENDING_EMAIL);
  await page.getByLabel("Password").fill(e2eSpendingPassword());
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
});

test("ICS import: full Corbett set as tiered drafts; re-import raises nothing; manual entry confirms directly", async ({
  page,
}) => {
  await page.goto("/dashboard/calendar");

  const icsFile = {
    name: "corbett-prep-2026-27.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(buildCorbettIcs(), "utf8"),
  };

  // --- Import: every event lands as a draft, named from X-WR-CALNAME.
  await page.getByLabel("Calendar file").setInputFiles(icsFile);
  await expect(
    page.getByText(
      `Corbett Prep 2026-27: ${CORBETT_EVENTS.length} new drafts, 0 already known.`
    )
  ).toBeVisible({ timeout: 20_000 });

  // --- Tiering: single-day bundle vs individual multi-day ranges.
  const source = page.getByRole("region", { name: "Corbett Prep 2026-27" });
  await expect(
    source.getByRole("button", {
      name: `Confirm all ${CORBETT_SINGLE_DAY_COUNT}`,
    })
  ).toBeVisible();
  await expect(source.getByRole("button", { name: "Dismiss" })).toHaveCount(
    CORBETT_MULTI_DAY_COUNT
  );
  await expect(source.getByText("Winter Break for Students")).toBeVisible();

  // --- Confirm-all ratifies the bundle in one action.
  await source
    .getByRole("button", { name: `Confirm all ${CORBETT_SINGLE_DAY_COUNT}` })
    .click();
  await expect(
    source.getByText(`${CORBETT_SINGLE_DAY_COUNT} confirmed events on the timeline`)
  ).toBeVisible({ timeout: 15_000 });

  // --- Individual rows confirm/dismiss independently.
  const winterBreak = source
    .locator("div")
    .filter({ hasText: "Winter Break for Students" })
    .filter({ has: page.getByRole("button", { name: "Confirm", exact: true }) })
    .last();
  await winterBreak.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    source.getByText(
      `${CORBETT_SINGLE_DAY_COUNT + 1} confirmed events on the timeline`
    )
  ).toBeVisible({ timeout: 15_000 });

  const thanksgiving = source
    .locator("div")
    .filter({ hasText: "Thanksgiving Week – School Closed" })
    .filter({ has: page.getByRole("button", { name: "Dismiss" }) })
    .last();
  await thanksgiving.getByRole("button", { name: "Dismiss" }).click();
  await expect(
    source.getByText("1 dismissed (won't be raised again)")
  ).toBeVisible({ timeout: 15_000 });

  // --- Re-import the identical file: natural-key dedup raises nothing new;
  // the dismissal stays dismissed.
  await page.getByLabel("Calendar file").setInputFiles(icsFile);
  await expect(
    page.getByText(
      `Corbett Prep 2026-27: 0 new drafts, ${CORBETT_EVENTS.length} already known.`
    )
  ).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(
    page.getByText("1 dismissed (won't be raised again)")
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Corbett Prep 2026-27" }).getByText(
      "Thanksgiving Week – School Closed"
    )
  ).toHaveCount(0);

  // --- Manual entry: CONFIRMED directly, no ratification ceremony.
  await page.getByLabel("Title").fill("Dentist — both kids");
  await page.getByLabel("Date", { exact: true }).fill("2026-09-22");
  await page.getByLabel("New category").fill("appointment");
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(
    page.getByText('Added "Dentist — both kids" to the timeline.')
  ).toBeVisible({ timeout: 15_000 });

  const manual = page.getByRole("region", { name: "Manual entries" });
  await expect(
    manual.getByText("1 confirmed event on the timeline")
  ).toBeVisible();
  await manual.getByText("1 confirmed event on the timeline").click();
  await expect(manual.getByText("Dentist — both kids")).toBeVisible();
  await expect(manual.getByText("appointment")).toBeVisible();
});
