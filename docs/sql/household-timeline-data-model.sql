-- Household Timeline data model (#54) — apply to Supabase manually.
-- This repo does not use Prisma Migrate; this DDL was generated with
-- `prisma migrate diff` from the schema change and spot-checked. Purely
-- additive: two new enums, two new tables — no existing table is touched.
--
-- Run in the Supabase SQL editor (or psql). Then re-run the enable-RLS
-- block at the bottom — Prisma-created tables are exposed via PostgREST
-- unless RLS is enabled on them.

-- CreateEnum
CREATE TYPE "CalendarSourceKind" AS ENUM ('IMPORT_PHOTO', 'IMPORT_ICS', 'MANUAL');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'DISMISSED');

-- CreateTable
CREATE TABLE "CalendarSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CalendarSourceKind" NOT NULL,
    "sourceStamp" TEXT,
    "categories" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "calendarSourceId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    "costCents" INTEGER,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "profileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarSource_userId_idx" ON "CalendarSource"("userId");

-- CreateIndex
CREATE INDEX "Event_calendarSourceId_startDate_idx" ON "Event"("calendarSourceId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "Event_calendarSourceId_startDate_normalizedTitle_key" ON "Event"("calendarSourceId", "startDate", "normalizedTitle");

-- AddForeignKey
ALTER TABLE "CalendarSource" ADD CONSTRAINT "CalendarSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_calendarSourceId_fkey" FOREIGN KEY ("calendarSourceId") REFERENCES "CalendarSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Enable RLS (no policies: the app reaches these tables only through Prisma's
-- direct Postgres connection; PostgREST/anon access is fully denied).
ALTER TABLE "CalendarSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
