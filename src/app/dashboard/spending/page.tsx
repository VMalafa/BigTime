import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { FIXED_COST_CATEGORIES } from "@/lib/constants/csp-ranges";
import { MONEY_DIALS } from "@/lib/constants/money-dials";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import {
  BUCKET_LABELS,
  isValidMonthKey,
  monthKeyFor,
  monthKeyLabel,
  monthRange,
  shiftMonthKey,
  summarizeMonth,
  SPENDING_BUCKETS,
  type SpendingBucket,
} from "@/lib/spending/month-summary";

// "Where is the money going" — reflective view on calendar months
// (ADR-0003; Pay Periods power the live heartbeat, not this page).

const DIAL_NAMES = new Map(MONEY_DIALS.map((d) => [d.category as string, d.name]));
const FIXED_COST_LABELS = new Map(
  FIXED_COST_CATEGORIES.map((c) => [c.key as string, c.label])
);

interface TransactionRow {
  id: string;
  postedAt: Date;
  amountCents: number;
  description: string;
  accountName: string;
  cspBucket: string;
  moneyDial: string | null;
  fixedCostCategory: string | null;
  isTransfer: boolean;
}

function secondLevelLabel(row: TransactionRow): string | null {
  if (row.moneyDial) return DIAL_NAMES.get(row.moneyDial) ?? row.moneyDial;
  if (row.fixedCostCategory)
    return FIXED_COST_LABELS.get(row.fixedCostCategory) ?? row.fixedCostCategory;
  return null;
}

function TransactionList({ rows }: { rows: TransactionRow[] }) {
  return (
    <ul className="divide-y divide-bg-secondary">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="font-sans text-sm text-text-primary truncate">
              {row.description}
            </p>
            <p className="text-xs text-text-secondary font-sans">
              {row.postedAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
              {" · "}
              {row.accountName}
              {secondLevelLabel(row) ? ` · ${secondLevelLabel(row)}` : ""}
            </p>
          </div>
          <p className="font-sans text-sm font-semibold text-text-primary shrink-0">
            {formatCurrency(row.amountCents / 100)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default async function SpendingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;
  const currentKey = monthKeyFor(new Date());
  const monthKey =
    params.month && isValidMonthKey(params.month) ? params.month : currentKey;
  const { start, endExclusive } = monthRange(monthKey);

  const [profiles, feedRows] = await Promise.all([
    prisma.profile.findMany({
      where: { userId: user.id },
      include: { spendingPlan: true, incomeSources: true },
    }),
    prisma.feedTransaction.findMany({
      where: {
        linkedAccount: { connection: { userId: user.id } },
        postedAt: { gte: start, lt: endExclusive },
      },
      orderBy: { postedAt: "desc" },
      select: {
        id: true,
        postedAt: true,
        amount: true,
        description: true,
        cspBucket: true,
        moneyDial: true,
        fixedCostCategory: true,
        isTransfer: true,
        linkedAccount: { select: { name: true } },
      },
    }),
  ]);

  const plan =
    profiles.find((p) => p.isDefault)?.spendingPlan ??
    profiles.find((p) => p.spendingPlan)?.spendingPlan ??
    null;
  const plannedIncomeCents = Math.round(
    profiles
      .flatMap((p) => p.incomeSources)
      .reduce((sum, s) => sum + Number(s.monthlyAmount), 0) * 100
  );

  const rows: TransactionRow[] = feedRows.map((r) => ({
    id: r.id,
    postedAt: r.postedAt,
    amountCents: Math.round(Number(r.amount) * 100),
    description: r.description,
    accountName: r.linkedAccount.name,
    cspBucket: r.cspBucket,
    moneyDial: r.moneyDial,
    fixedCostCategory: r.fixedCostCategory,
    isTransfer: r.isTransfer,
  }));

  const summary = summarizeMonth(
    rows.map((r) => ({
      amountCents: r.amountCents,
      cspBucket: r.cspBucket,
      isTransfer: r.isTransfer,
    })),
    plan,
    plannedIncomeCents
  );

  const spendingRows = (bucket: SpendingBucket) =>
    rows.filter(
      (r) => !r.isTransfer && r.cspBucket === bucket && r.amountCents < 0
    );
  const uncategorizedRows = rows.filter(
    (r) => !r.isTransfer && r.cspBucket === "UNCATEGORIZED" && r.amountCents < 0
  );
  const transferRows = rows.filter((r) => r.isTransfer);

  const prevKey = shiftMonthKey(monthKey, -1);
  const nextKey = shiftMonthKey(monthKey, 1);
  const barWidth = (percent: number) => `${Math.min(100, Math.max(0, percent))}%`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-serif text-3xl text-text-primary">Spending</h1>
        <div className="flex items-center gap-2 font-sans text-sm">
          <Link
            href={`/dashboard/spending?month=${prevKey}`}
            aria-label="Previous month"
            className="px-2.5 py-1.5 rounded-md border border-bg-secondary bg-white text-text-secondary hover:text-text-primary"
          >
            ←
          </Link>
          <span className="font-medium text-text-primary min-w-32 text-center">
            {monthKeyLabel(monthKey)}
          </span>
          <Link
            href={`/dashboard/spending?month=${nextKey}`}
            aria-label="Next month"
            className="px-2.5 py-1.5 rounded-md border border-bg-secondary bg-white text-text-secondary hover:text-text-primary"
          >
            →
          </Link>
        </div>
      </div>
      <p className="text-text-secondary font-sans text-sm mb-4">
        Where the money went, in your plan&apos;s own language. Transfers
        between your own accounts are excluded.
      </p>

      {/* Honesty chip: uncategorized spending is shown, never hidden. */}
      {summary.uncategorizedCount > 0 && (
        <div className="inline-flex items-center gap-2 rounded-full border border-warning bg-warning/10 px-4 py-1.5 mb-6">
          <span className="w-2 h-2 rounded-full bg-warning" aria-hidden />
          <span className="font-sans text-sm text-text-primary">
            {summary.uncategorizedCount} transaction
            {summary.uncategorizedCount !== 1 ? "s" : ""} not yet categorized (
            {formatCurrency(summary.uncategorizedCents / 100)})
          </span>
        </div>
      )}

      <div className="rounded-lg bg-white border border-bg-secondary p-5 mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-serif text-xl text-text-primary">
            Plan vs. actual
          </h2>
          <p className="text-xs text-text-secondary font-sans">
            {summary.incomeSource === "feed" &&
              `of ${formatCurrency(summary.incomeCents / 100)} income this month`}
            {summary.incomeSource === "plan" &&
              `of ${formatCurrency(summary.incomeCents / 100)} planned monthly income (no feed income this month)`}
            {summary.incomeSource === "none" && "no income to measure against"}
          </p>
        </div>

        <div className="space-y-5">
          {summary.buckets.map((bucket) => (
            <div key={bucket.bucket} data-bucket={bucket.bucket}>
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="font-sans text-sm font-medium text-text-primary">
                  {BUCKET_LABELS[bucket.bucket]}
                </p>
                <p className="font-sans text-xs text-text-secondary">
                  plan {formatPercent(bucket.planPercent)} · actual{" "}
                  {formatPercent(bucket.actualPercent)} (
                  {formatCurrency(bucket.actualCents / 100)})
                </p>
              </div>
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-text-secondary/40"
                    style={{ width: barWidth(bucket.planPercent) }}
                  />
                </div>
                <div className="h-2 rounded-full bg-bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-gold"
                    style={{ width: barWidth(bucket.actualPercent) }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-text-secondary font-sans">
          Gray bar: plan. Gold bar: actual share of this month&apos;s income.
        </p>
      </div>

      {rows.length === 0 && (
        <div className="rounded-lg bg-white border border-bg-secondary p-8 text-center">
          <p className="font-serif text-lg text-text-primary mb-1">
            No feed transactions this month.
          </p>
          <p className="text-sm text-text-secondary font-sans">
            Link an account or pick another month to see where the money went.
          </p>
        </div>
      )}

      <div className="space-y-8">
        {SPENDING_BUCKETS.map((bucket) => {
          const bucketRows = spendingRows(bucket);
          if (bucketRows.length === 0) return null;
          return (
            <section key={bucket} aria-label={BUCKET_LABELS[bucket]}>
              <h2 className="font-serif text-xl text-text-primary mb-2">
                {BUCKET_LABELS[bucket]}
              </h2>
              <div className="rounded-lg bg-white border border-bg-secondary px-5 py-2">
                <TransactionList rows={bucketRows} />
              </div>
            </section>
          );
        })}

        {uncategorizedRows.length > 0 && (
          <section aria-label="Not yet categorized">
            <h2 className="font-serif text-xl text-text-primary mb-2">
              Not yet categorized
            </h2>
            <p className="text-xs text-text-secondary font-sans mb-2">
              These count toward the month&apos;s spending but not toward any
              bucket yet. The next categorization batch will pick them up.
            </p>
            <div className="rounded-lg bg-white border border-warning/50 px-5 py-2">
              <TransactionList rows={uncategorizedRows} />
            </div>
          </section>
        )}

        {transferRows.length > 0 && (
          <section aria-label="Transfers">
            <h2 className="font-serif text-xl text-text-primary mb-2">
              Transfers between your accounts
            </h2>
            <p className="text-xs text-text-secondary font-sans mb-2">
              Money moving between your own accounts — excluded from spending
              and income.
            </p>
            <div className="rounded-lg bg-white border border-bg-secondary px-5 py-2 opacity-70">
              <TransactionList rows={transferRows} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
