-- Enable RLS on every Prisma-created table that shipped without it (#92).
--
-- Supabase exposes public-schema tables through PostgREST, so any table
-- without Row Level Security is readable AND writable by anyone holding the
-- anon key that ships in the client bundle. The app reaches all of these
-- tables only through Prisma's direct Postgres connection, which bypasses
-- RLS entirely — so enabling RLS with NO policies (deny-all for
-- PostgREST/anon, the CalendarSource/Event pattern) is a no-op for the app
-- and a full lockout for the anon key.
--
-- The build issue named the 8 legacy tables; the 2026-07-19 survey
-- (pg_class.relrowsecurity) found 8 more created by later `prisma db push`
-- runs with the same exposure. All 16 are closed here.
--
-- MAINTENANCE RULE: `prisma db push` / Prisma migrations create tables with
-- RLS DISABLED. Every new model added to prisma/schema.prisma needs an
-- ALTER TABLE "<Model>" ENABLE ROW LEVEL SECURITY here (or in its own
-- migration doc) before it ships. The e2e suite pins this: e2e/rls-smoke
-- probes PostgREST with the anon key and fails on any readable row.

-- The 8 legacy tables named in #92
ALTER TABLE "AggregatorConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LinkedAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CategoryRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProposalDecision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FixedCostLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BonusItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditPlan" ENABLE ROW LEVEL SECURITY;

-- Later db-push tables with the same exposure (survey 2026-07-19)
ALTER TABLE "CalendarFeedToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InboundEmail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MoneyDate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Goal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Milestone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BonusPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BonusMoment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BonusMove" ENABLE ROW LEVEL SECURITY;
