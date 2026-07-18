// ICS-subset parser for Calendar Source imports (#55).
//
// Deliberately small (see docs/research/calendar-ingestion.md): school
// calendars are date-only VEVENTs — DTSTART;VALUE=DATE, exclusive DTEND,
// SUMMARY, optional DESCRIPTION. Folded lines are unfolded, text values
// unescaped, VTIMEZONE ignored, and RRULE deferred (schools enumerate
// occurrences). Timed events are outside the subset and reported as
// skipped rather than silently dropped. Round-trips the household's own
// scheduler export (docs/research/assets/corbett-calendar-scheduler.html).

export interface ParsedIcsEvent {
  /** Date-only ISO (YYYY-MM-DD). */
  startDate: string;
  /** Exclusive end, only for genuine multi-day events. */
  endDate?: string;
  title: string;
  note?: string;
}

export interface ParsedIcsCalendar {
  /** X-WR-CALNAME when present — the natural Calendar Source name. */
  calendarName: string | null;
  events: ParsedIcsEvent[];
  /** VEVENTs outside the date-only subset (timed, or missing fields). */
  skipped: number;
}

const DATE_VALUE = /^(\d{4})(\d{2})(\d{2})$/;

function toIsoDate(value: string): string | null {
  const match = DATE_VALUE.exec(value.trim());
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** RFC 5545 text unescaping: \\n, \\, \\; and \\\\. */
function unescapeText(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = value[i + 1];
    if (next === "n" || next === "N") {
      out += "\n";
      i++;
    } else if (next === "," || next === ";" || next === "\\") {
      out += next;
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Split a content line into (name, params, value). */
function parseLine(
  line: string
): { name: string; params: string[]; value: string } | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const [name, ...params] = line.slice(0, colon).split(";");
  return {
    name: name.toUpperCase(),
    params: params.map((p) => p.toUpperCase()),
    value: line.slice(colon + 1),
  };
}

export function parseIcsCalendar(text: string): ParsedIcsCalendar {
  // Unfold: a CRLF (or LF) followed by a space/tab continues the line.
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);

  let calendarName: string | null = null;
  const events: ParsedIcsEvent[] = [];
  let skipped = 0;

  let inEvent = false;
  let start: string | null = null;
  let startTimed = false;
  let end: string | null = null;
  let title: string | null = null;
  let note: string | null = null;

  for (const raw of lines) {
    const line = parseLine(raw);
    if (!line) continue;

    if (line.name === "BEGIN" && line.value.toUpperCase() === "VEVENT") {
      inEvent = true;
      start = null;
      startTimed = false;
      end = null;
      title = null;
      note = null;
      continue;
    }

    if (line.name === "END" && line.value.toUpperCase() === "VEVENT") {
      inEvent = false;
      if (start && !startTimed && title !== null && title.trim() !== "") {
        // Exclusive DTEND: start+1 (or absent) is a single day.
        const exclusiveEnd =
          end && end !== start && end !== addDays(start, 1) ? end : undefined;
        if (exclusiveEnd && exclusiveEnd < start) {
          skipped++;
        } else {
          events.push({
            startDate: start,
            endDate: exclusiveEnd,
            title: title.trim(),
            note: note?.trim() || undefined,
          });
        }
      } else {
        skipped++;
      }
      continue;
    }

    if (!inEvent) {
      if (line.name === "X-WR-CALNAME") {
        calendarName = unescapeText(line.value).trim() || null;
      }
      continue;
    }

    switch (line.name) {
      case "DTSTART": {
        const iso = toIsoDate(line.value);
        if (iso) {
          start = iso;
        } else {
          // A timed DTSTART (e.g. 20260812T090000Z) is outside the subset.
          startTimed = true;
        }
        break;
      }
      case "DTEND": {
        end = toIsoDate(line.value);
        break;
      }
      case "SUMMARY":
        title = unescapeText(line.value);
        break;
      case "DESCRIPTION":
        note = unescapeText(line.value);
        break;
    }
  }

  return { calendarName, events, skipped };
}
