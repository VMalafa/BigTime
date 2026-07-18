// The Corbett Prep 2026-27 event set, verbatim from the household's
// hand-built scheduler (docs/research/assets/corbett-calendar-scheduler.html)
// — the ground-truth artifact for calendar ingestion (#55). buildCorbettIcs
// mirrors the scheduler's buildICS byte format (CRLF, explicit exclusive
// DTEND even for single-day events, \-escaped text) with all events
// selected.

export interface CorbettEvent {
  date: string;
  end?: string;
  title: string;
  cat: string;
  note?: string;
}

export const CORBETT_EVENTS: CorbettEvent[] = [
  { date: "2026-07-31", end: "2026-08-08", title: "Pre-Planning & Faculty In-Service", cat: "academic", note: "Fri 7/31–Fri 8/7" },
  { date: "2026-08-10", title: "New Parent Orientation & Back-to-School Night (PreK3-K)", cat: "event" },
  { date: "2026-08-10", title: "Student Orientations", cat: "event" },
  { date: "2026-08-12", title: "First Day of School for Students", cat: "academic", note: "Noon Dismissal for PreK3, PreK4 & Kindergarten only" },
  { date: "2026-08-13", end: "2026-08-15", title: "Noon Dismissal – PreK3, PreK4 & Kindergarten only", cat: "dismissal" },
  { date: "2026-08-18", title: "Back-to-School Night – 1st-4th Grade Parents", cat: "event" },
  { date: "2026-08-25", title: "Back-to-School Night – 5th-8th Grade Parents", cat: "event" },
  { date: "2026-09-07", title: "Labor Day – School Holiday", cat: "holiday" },
  { date: "2026-09-16", title: "Noon Dismissal – Faculty In-Service", cat: "dismissal", note: "Extended Day Available" },
  { date: "2026-10-07", title: "Noon Dismissal – Conferences", cat: "dismissal", note: "Extended Day Available" },
  { date: "2026-10-08", end: "2026-10-10", title: "Parent-Teacher Conferences – School Closed for Students", cat: "holiday" },
  { date: "2026-10-12", title: "School Holiday", cat: "holiday" },
  { date: "2026-10-15", title: "Giving Day", cat: "event" },
  { date: "2026-10-30", title: "Trimester 1 Ends", cat: "academic" },
  { date: "2026-11-06", title: "Teachers & Faculty – FCIS Conference / Student Holiday", cat: "holiday" },
  { date: "2026-11-16", end: "2026-11-20", title: "Fine Arts Concerts", cat: "event" },
  { date: "2026-11-20", title: "Grandparents' Day & Noon Dismissal", cat: "dismissal", note: "Extended Day Closed" },
  { date: "2026-11-23", end: "2026-11-28", title: "Thanksgiving Week – School Closed", cat: "break" },
  { date: "2026-12-18", title: "Noon Dismissal – Faculty In-Service", cat: "dismissal", note: "Extended Day Closed" },
  { date: "2026-12-21", end: "2027-01-05", title: "Winter Break for Students", cat: "break" },
  { date: "2027-01-04", title: "Faculty In-Service – School Closed for Students", cat: "holiday" },
  { date: "2027-01-05", title: "Students Return from Break", cat: "academic" },
  { date: "2027-01-18", title: "Martin Luther King Jr. Day – School Holiday", cat: "holiday" },
  { date: "2027-01-27", title: "Noon Dismissal – Faculty In-Service", cat: "dismissal", note: "Extended Day Available" },
  { date: "2027-01-28", end: "2027-01-30", title: "Parent-Teacher Conferences – School Closed for Students", cat: "holiday" },
  { date: "2027-02-06", title: "School Carnival", cat: "event" },
  { date: "2027-02-15", title: "Presidents' Day – School Holiday", cat: "holiday" },
  { date: "2027-02-19", title: "Trimester 2 Ends", cat: "academic" },
  { date: "2027-03-03", title: "Noon Dismissal – Faculty In-Service", cat: "dismissal", note: "Extended Day Available" },
  { date: "2027-03-19", title: "Noon Dismissal – Faculty In-Service", cat: "dismissal", note: "Extended Day Closed" },
  { date: "2027-03-22", end: "2027-03-30", title: "Spring Break for Students", cat: "break" },
  { date: "2027-03-29", title: "Faculty In-Service – School Closed for Students", cat: "holiday" },
  { date: "2027-03-30", title: "Students Return from Break", cat: "academic" },
  { date: "2027-04-07", title: "Noon Dismissal – Faculty In-Service", cat: "dismissal", note: "Extended Day Available" },
  { date: "2027-04-22", title: "Faculty In-Service – School Closed for Students", cat: "holiday" },
  { date: "2027-04-23", title: "School Closed", cat: "holiday" },
  { date: "2027-05-05", title: "Noon Dismissal – Faculty In-Service", cat: "dismissal", note: "Extended Day Available" },
  { date: "2027-05-27", title: "8th Grade Graduation Celebration", cat: "event" },
  { date: "2027-05-27", title: "Trimester 3 Ends / Last Day of School for Students", cat: "academic", note: "Full Day for PreK3-7th Grade" },
  { date: "2027-05-28", end: "2027-06-05", title: "Teacher Post-Planning", cat: "academic" },
];

export const CORBETT_SINGLE_DAY_COUNT = CORBETT_EVENTS.filter(
  (e) => !e.end
).length;
export const CORBETT_MULTI_DAY_COUNT = CORBETT_EVENTS.filter(
  (e) => e.end
).length;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function icsDate(iso: string): string {
  return iso.replaceAll("-", "");
}

function addDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function esc(s: string): string {
  return s.replace(/[\\,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}

export function buildCorbettIcs(): string {
  const out = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Corbett Prep//Calendar Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Corbett Prep 2026-27",
  ];
  CORBETT_EVENTS.forEach((e, idx) => {
    const dtEnd = e.end ? icsDate(e.end) : icsDate(addDay(e.date));
    out.push(
      "BEGIN:VEVENT",
      `UID:${icsDate(e.date)}-${idx}@corbettprep`,
      "DTSTAMP:20260603T120000Z",
      `DTSTART;VALUE=DATE:${icsDate(e.date)}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${esc(e.title)}`
    );
    if (e.note) out.push(`DESCRIPTION:${esc(e.note)}`);
    out.push("TRANSP:TRANSPARENT", "END:VEVENT");
  });
  out.push("END:VCALENDAR");
  return out.join("\r\n");
}
