import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { detectRecurringPatterns } from "@/lib/recurring/pattern-engine";
import { filterPaycheckDeposits } from "@/lib/heartbeat/pay-period";
import { deriveMoneyMoments } from "@/lib/timeline/money-moments";
import {
  TimelineStream,
  type TimelineEventItem,
  type TimelineFilterSource,
  type TimelinePerson,
} from "@/components/timeline/TimelineStream";

// The Household Timeline (#56, ratified in #32): one merged, forward-looking
// stream — CONFIRMED Events interleaved with money moments derived live from
// the heartbeat/recurring engines. Server-component read per #29. Success
// test: the Sunday scan — either parent reads the coming two weeks in under
// a minute.

const LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000;
const HORIZON_DAYS = 60;

export default async function TimelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const [events, sources, profiles, confirmedStreams, transactions, planRows] =
    await Promise.all([
      prisma.event.findMany({
        where: {
          calendarSource: { userId: user.id },
          status: "CONFIRMED",
          OR: [
            { startDate: { gte: todayUtc } },
            { endDate: { gt: todayUtc } },
          ],
        },
        include: {
          calendarSource: { select: { id: true, name: true } },
          profile: { select: { id: true, name: true } },
        },
        orderBy: [{ startDate: "asc" }, { title: "asc" }],
      }),
      prisma.calendarSource.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, categories: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.profile.findMany({
        where: { userId: user.id },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.proposalDecision.findMany({
        where: { userId: user.id, kind: "INCOME", decision: "CONFIRMED" },
        select: { key: true },
      }),
      prisma.feedTransaction.findMany({
        where: {
          linkedAccount: { connection: { userId: user.id } },
          postedAt: { gte: new Date(Date.now() - LOOKBACK_MS) },
          isTransfer: false,
        },
        select: {
          id: true,
          postedAt: true,
          amount: true,
          description: true,
          isTransfer: true,
        },
      }),
      prisma.profile.findMany({
        where: { userId: user.id },
        include: { spendingPlan: { include: { fixedCostLineItems: true } } },
      }),
    ]);

  // Money moments, derived exactly the way the heartbeat derives its state.
  const paychecks = filterPaycheckDeposits(
    transactions
      .filter((t) => Number(t.amount) > 0)
      .map((t) => ({
        postedAt: t.postedAt,
        amountCents: Math.round(Number(t.amount) * 100),
        description: t.description,
      })),
    confirmedStreams.map((s) => s.key)
  );
  const chargePatterns = detectRecurringPatterns(
    transactions.map((t) => ({
      id: t.id,
      postedAt: t.postedAt,
      amountCents: Math.round(Number(t.amount) * 100),
      description: t.description,
      isTransfer: t.isTransfer,
    }))
  );
  const plan =
    planRows.find((p) => p.isDefault)?.spendingPlan ??
    planRows.find((p) => p.spendingPlan)?.spendingPlan ??
    null;
  const moments = deriveMoneyMoments({
    paychecks,
    chargePatterns,
    lineItems: (plan?.fixedCostLineItems ?? []).map((item) => ({
      name: item.name,
      monthlyAmountCents: Math.round(Number(item.monthlyAmount) * 100),
    })),
    plan: plan
      ? {
          savingsPercent: plan.savingsPercent,
          investmentsPercent: plan.investmentsPercent,
        }
      : null,
    now,
    horizonDays: HORIZON_DAYS,
  });

  const eventItems: TimelineEventItem[] = events.map((event) => ({
    id: event.id,
    date: event.startDate.toISOString().slice(0, 10),
    endDate: event.endDate ? event.endDate.toISOString().slice(0, 10) : null,
    title: event.title,
    category: event.category,
    note: event.note,
    costCents: event.costCents,
    sourceId: event.calendarSource.id,
    sourceName: event.calendarSource.name,
    profileId: event.profile?.id ?? null,
    profileName: event.profile?.name ?? null,
    assigneeExtra: event.assigneeExtra,
  }));

  const filterSources: TimelineFilterSource[] = sources
    .filter((s) => eventItems.some((e) => e.sourceId === s.id))
    .map((s) => ({ id: s.id, name: s.name, categories: s.categories }));

  const people: TimelinePerson[] = profiles.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  // Honesty Rule: when the money rhythm can't render, say why — quietly.
  const rhythmNote =
    confirmedStreams.length === 0
      ? "Confirm an income stream on the Income page and your paydays, due dates, and Money Dates will appear here."
      : paychecks.length === 0
        ? "No paycheck from a confirmed income stream has landed yet — the money rhythm appears once one does."
        : null;

  return (
    <div>
      <h1 className="font-serif text-3xl text-text-primary mb-2">
        Household Timeline
      </h1>
      <p className="text-text-secondary font-sans text-sm mb-6 max-w-2xl">
        The school year and the money rhythm, one stream. Scan the coming two
        weeks — every day-quirk, payday, and due date — without opening
        another app.
      </p>
      <TimelineStream
        events={eventItems}
        moments={moments}
        sources={filterSources}
        people={people}
        rhythmNote={rhythmNote}
      />
    </div>
  );
}
