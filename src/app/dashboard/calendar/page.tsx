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

  const sources = await prisma.calendarSource.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { events: { orderBy: [{ startDate: "asc" }, { title: "asc" }] } },
  });

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
    </div>
  );
}
