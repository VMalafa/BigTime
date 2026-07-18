// Timeline .ics export (#58): scheduler parity, in-app. Byte-for-byte the
// format the household's standalone scheduler already proves — CRLF lines,
// date-only VEVENTs with an explicit EXCLUSIVE DTEND (start+1 for
// single-day), \-escaped SUMMARY/DESCRIPTION, TRANSP:TRANSPARENT — so the
// file opens in Apple/Google/Outlook and re-imports through the #55 parser
// with zero drift. Money-rhythm moments are never exported in v1 (they
// stay in-app; #35 owns the subscribable-feed question).

export interface ExportableEvent {
  /** Date-only ISO. */
  startDate: string;
  /** Exclusive end; null/undefined = single-day. */
  endDate?: string | null;
  title: string;
  note?: string | null;
}

function icsDate(iso: string): string {
  return iso.replaceAll("-", "");
}

function addDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** RFC 5545 text escaping, exactly as the scheduler's esc(). */
function esc(value: string): string {
  return value.replace(/[\\,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}

function dtStamp(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

export function buildIcsExport(input: {
  /** Becomes X-WR-CALNAME — when the selection is one Calendar Source,
   * pass its name so a re-import lands on the same source and dedups. */
  calendarName: string;
  events: ExportableEvent[];
  now: Date;
}): string {
  const stamp = dtStamp(input.now);
  const out = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Your Rich Life//Household Timeline//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(input.calendarName)}`,
  ];
  input.events.forEach((event, index) => {
    const dtEnd = event.endDate
      ? icsDate(event.endDate)
      : icsDate(addDay(event.startDate));
    out.push(
      "BEGIN:VEVENT",
      `UID:${icsDate(event.startDate)}-${index}@rich-life-timeline`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(event.startDate)}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${esc(event.title)}`
    );
    if (event.note) out.push(`DESCRIPTION:${esc(event.note)}`);
    out.push("TRANSP:TRANSPARENT", "END:VEVENT");
  });
  out.push("END:VCALENDAR");
  return out.join("\r\n");
}
