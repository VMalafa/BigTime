import { describe, expect, it } from "vitest";
import { validateExtraction, CONFIRM_ALL_MIN_CONFIDENCE } from "./extraction.ts";
import { partitionDraftTiers } from "./ingestion.ts";
import { CORBETT_EVENTS } from "../../../e2e/corbett-fixture";

// The uploaded Corbett photo's hand-built transcription is the ground
// truth (#57): a model answer matching it must round-trip the validation
// layer with every date, range, note, and category intact, and route the
// catalogued ambiguity classes to individual review.

const CORBETT_CATEGORIES = ["holiday", "dismissal", "break", "event", "academic"];

function corbettToolInput() {
  return {
    calendarName: "Corbett Prep 2026-27",
    categories: CORBETT_CATEGORIES,
    events: CORBETT_EVENTS.map((e) => ({
      date: e.date,
      end: e.end,
      title: e.title,
      category: e.cat,
      note: e.note,
      confidence: 1,
    })),
  };
}

describe("validateExtraction", () => {
  it("reproduces the hand-transcribed Corbett EVENTS array intact", () => {
    const result = validateExtraction(corbettToolInput());
    expect(result).not.toBeNull();
    expect(result!.calendarName).toBe("Corbett Prep 2026-27");
    expect(result!.categories).toEqual(CORBETT_CATEGORIES);
    expect(result!.rejected).toBe(0);
    expect(result!.events).toHaveLength(CORBETT_EVENTS.length);
    result!.events.forEach((event, i) => {
      expect(event.date).toBe(CORBETT_EVENTS[i].date);
      expect(event.end).toBe(CORBETT_EVENTS[i].end);
      expect(event.title).toBe(CORBETT_EVENTS[i].title);
      expect(event.category).toBe(CORBETT_EVENTS[i].cat);
      expect(event.note).toBe(CORBETT_EVENTS[i].note);
    });
  });

  it("routes the catalogued ambiguity classes to individual review", () => {
    const result = validateExtraction(corbettToolInput())!;
    const { confirmAll, individual } = partitionDraftTiers(
      result.events.map((e) => ({ ...e, startDate: e.date, endDate: e.end })),
      { siblingsToIndividual: true }
    );

    // Multi-day ranges — including the year-boundary Winter Break span.
    const individualTitles = individual.map((e) => e.title);
    expect(individualTitles).toContain("Winter Break for Students");
    expect(individualTitles).toContain("Thanksgiving Week – School Closed");
    // Same-day siblings must not be bundled: two events on 8/10, two on 5/27.
    expect(individualTitles).toContain("Student Orientations");
    expect(individualTitles).toContain("8th Grade Graduation Celebration");
    expect(individualTitles).toContain(
      "Trimester 3 Ends / Last Day of School for Students"
    );
    // Everything explicit and single-day bundles into confirm-all.
    const rangeCount = CORBETT_EVENTS.filter((e) => e.end).length;
    expect(individual.length).toBe(rangeCount + 4); // 9 ranges + 2 sibling pairs
    expect(confirmAll.length).toBe(CORBETT_EVENTS.length - individual.length);
  });

  it("rejects invalid rows without dropping the batch, and reports them", () => {
    const result = validateExtraction({
      calendarName: "",
      categories: ["holiday"],
      events: [
        { date: "2026-02-31", title: "Rolled-over date", category: "holiday", confidence: 1 },
        { date: "2026-10-01", title: "", category: "holiday", confidence: 1 },
        { date: "2026-10-10", end: "2026-10-05", title: "Inverted", category: "holiday", confidence: 1 },
        { date: "2026-10-12", title: "School Holiday", category: "holiday", confidence: 1 },
      ],
    })!;
    expect(result.rejected).toBe(3);
    expect(result.events).toHaveLength(1);
    expect(result.calendarName).toBeNull();
  });

  it("falls back to the vocabulary's first word for out-of-vocabulary categories", () => {
    const result = validateExtraction({
      calendarName: "X",
      categories: ["holiday", "event"],
      events: [
        { date: "2026-10-12", title: "Mystery", category: "banana", confidence: 1 },
      ],
    })!;
    expect(result.events[0].category).toBe("holiday");
  });

  it("clamps malformed confidence to the uncertain middle, below the confirm-all floor", () => {
    const result = validateExtraction({
      calendarName: "X",
      categories: ["event"],
      events: [{ date: "2026-10-12", title: "Odd", category: "event", confidence: 7 }],
    })!;
    expect(result.events[0].confidence).toBe(0.5);
    expect(result.events[0].confidence).toBeLessThan(CONFIRM_ALL_MIN_CONFIDENCE);
  });

  it("returns null for shapeless input (the graceful-failure path)", () => {
    expect(validateExtraction(null)).toBeNull();
    expect(validateExtraction({ events: "nope" })).toBeNull();
  });
});
