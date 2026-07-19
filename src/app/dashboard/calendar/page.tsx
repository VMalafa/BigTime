import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  CalendarIngestion,
  type SerializedSource,
} from "@/components/timeline/CalendarIngestion";

// Calendar ingestion & review (#55): the deterministic paths into the
// Household Timeline — ICS import with tiered ratification, and manual
// entry. Server-component read per #29; the merged timeline surface itself
// is #56's.

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [sources, inboundEmails] = await Promise.all([
    prisma.calendarSource.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: {
        events: { orderBy: [{ startDate: "asc" }, { title: "asc" }] },
      },
    }),
    // The email spine's honest ledger (#69): every forwarded email and
    // what became of it — parked ones stay visible, never dropped.
    prisma.inboundEmail.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const serialized: SerializedSource[] = sources.map((source) => ({
    id: source.id,
    name: source.name,
    kind: source.kind,
    sourceStamp: source.sourceStamp,
    categories: source.categories,
    events: source.events.map((event) => ({
      id: event.id,
      startDate: event.startDate.toISOString().slice(0, 10),
      endDate: event.endDate ? event.endDate.toISOString().slice(0, 10) : null,
      title: event.title,
      category: event.category,
      note: event.note,
      costCents: event.costCents,
      status: event.status,
    })),
  }));

  return (
    <div>
      <h1 className="font-serif text-3xl text-text-primary mb-2">
        Calendar Sources
      </h1>
      <p className="text-text-secondary font-sans text-sm mb-6 max-w-2xl">
        Bring the school year into your Household Timeline. Import a calendar
        file and ratify what lands — imported events are drafts until you
        confirm them — or add a one-off event by hand.
      </p>
      <CalendarIngestion sources={serialized} />

      {inboundEmails.length > 0 && (
        <section aria-label="Forwarded email" className="mt-10">
          <h2 className="font-serif text-xl text-text-primary mb-1">
            Forwarded email
          </h2>
          <p className="text-text-secondary font-sans text-sm mb-4 max-w-2xl">
            Everything that arrived at the household&apos;s inbound address and
            what became of it. Parked emails are kept — nothing is dropped.
          </p>
          <ul className="space-y-2">
            {inboundEmails.map((email) => (
              <li
                key={email.id}
                data-inbound-status={email.status.toLowerCase()}
                className="rounded-lg bg-white border border-bg-secondary px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-sans text-sm font-medium text-text-primary">
                    {email.subject || "(no subject)"}
                  </span>
                  <span className="text-xs font-sans text-text-secondary">
                    {email.fromAddress}
                  </span>
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-xs font-sans ${
                      email.status === "PROCESSED"
                        ? "bg-success/10 text-success"
                        : email.status === "PARKED"
                          ? "bg-warning/10 text-warning"
                          : "bg-error/10 text-error"
                    }`}
                  >
                    {email.status.toLowerCase()}
                  </span>
                </div>
                <p className="text-xs font-sans text-text-secondary mt-1">
                  {email.note}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
