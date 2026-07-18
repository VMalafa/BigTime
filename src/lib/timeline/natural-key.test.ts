import { describe, expect, it } from "vitest";
import { normalizeEventTitle } from "./natural-key.ts";

describe("normalizeEventTitle", () => {
  it("lowercases", () => {
    expect(normalizeEventTitle("First Day of School")).toBe(
      "first day of school"
    );
    expect(normalizeEventTitle("FIRST DAY OF SCHOOL")).toBe(
      "first day of school"
    );
  });

  it("collapses interior whitespace and trims ends", () => {
    expect(normalizeEventTitle("  Winter   Break \t")).toBe("winter break");
    expect(normalizeEventTitle("Winter\nBreak")).toBe("winter break");
  });

  it("strips punctuation to single spaces", () => {
    // The Corbett artifact's real shapes: en-dashes, commas, ampersands.
    expect(
      normalizeEventTitle("Noon Dismissal – PreK3, PreK4 & Kindergarten only")
    ).toBe("noon dismissal prek3 prek4 kindergarten only");
    expect(normalizeEventTitle("Back-to-School Night")).toBe(
      "back to school night"
    );
    expect(normalizeEventTitle("Teacher In-Service (No School)")).toBe(
      "teacher in service no school"
    );
  });

  it("keeps digits (grade levels, times, years)", () => {
    expect(normalizeEventTitle("Back-to-School Night – 1st-4th Grade")).toBe(
      "back to school night 1st 4th grade"
    );
  });

  it("treats casing/whitespace/punctuation variants as the same key", () => {
    const variants = [
      "Noon Dismissal – PreK3, PreK4 & Kindergarten only",
      "noon dismissal  PreK3 PreK4 and? no — & Kindergarten only", // not identical text
    ];
    // Sanity: differently-written titles still produce distinct keys...
    expect(normalizeEventTitle(variants[0])).not.toBe(
      normalizeEventTitle(variants[1])
    );
    // ...but pure formatting variants of one title collapse to one key.
    const formattingVariants = [
      "Noon Dismissal – PreK3, PreK4 & Kindergarten only",
      "NOON DISMISSAL - PreK3 PreK4 and Kindergarten only".replace(
        " and ",
        " & "
      ),
      "  noon   dismissal:  prek3,prek4 &  kindergarten only!  ",
    ];
    const keys = new Set(formattingVariants.map(normalizeEventTitle));
    expect(keys.size).toBe(1);
  });

  it("never produces leading/trailing spaces, even for punctuation-wrapped titles", () => {
    expect(normalizeEventTitle("*** Carnival ***")).toBe("carnival");
    expect(normalizeEventTitle("¡Fiesta!")).toBe("fiesta");
  });
});
