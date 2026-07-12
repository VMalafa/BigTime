-- Account Aggregation Foundation (Phase 1) — apply to Supabase manually.
-- This repo does not use Prisma Migrate; this DDL was generated with
-- `prisma migrate diff` from the schema change and spot-checked.
--
-- Run in the Supabase SQL editor (or psql). Then re-run the enable-RLS
-- block at the bottom — Prisma-created tables are exposed via PostgREST
-- unless RLS is enabled on them.

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'ERROR', 'REVOKED');

-- CreateEnum
CREATE TYPE "LinkedAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'LOAN', 'INVESTMENT', 'OTHER');

-- CreateTable
CREATE TABLE "AggregatorConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedAccessSecret" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggregatorConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedAccount" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "accountType" "LinkedAccountType" NOT NULL,
    "maskedNumber" TEXT,
    "currentBalance" DECIMAL(12,2) NOT NULL,
    "balanceAsOf" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "profileId" TEXT,
    "mappedDebtId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedTransaction" (
    "id" TEXT NOT NULL,
    "linkedAccountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AggregatorConnection_userId_idx" ON "AggregatorConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedAccount_mappedDebtId_key" ON "LinkedAccount"("mappedDebtId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedAccount_connectionId_externalId_key" ON "LinkedAccount"("connectionId", "externalId");

-- CreateIndex
CREATE INDEX "FeedTransaction_linkedAccountId_postedAt_idx" ON "FeedTransaction"("linkedAccountId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeedTransaction_linkedAccountId_externalId_key" ON "FeedTransaction"("linkedAccountId", "externalId");

-- AddForeignKey
ALTER TABLE "AggregatorConnection" ADD CONSTRAINT "AggregatorConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedAccount" ADD CONSTRAINT "LinkedAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AggregatorConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedAccount" ADD CONSTRAINT "LinkedAccount_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedAccount" ADD CONSTRAINT "LinkedAccount_mappedDebtId_fkey" FOREIGN KEY ("mappedDebtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedTransaction" ADD CONSTRAINT "FeedTransaction_linkedAccountId_fkey" FOREIGN KEY ("linkedAccountId") REFERENCES "LinkedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS (no policies: the app reaches these tables only through Prisma's
-- direct Postgres connection; PostgREST/anon access is fully denied).
ALTER TABLE "AggregatorConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LinkedAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedTransaction" ENABLE ROW LEVEL SECURITY;
