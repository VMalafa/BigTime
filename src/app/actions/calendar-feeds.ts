"use server";

// Feed token management (#90): mint, rotate, revoke — each an awaited
// per-intent action per the ratified #29 architecture. The token is
// generated server-side only; the client never chooses it.

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/auth/request-user";

const SETTINGS_PATH = "/dashboard/settings";

/** 32 random bytes, base64url — the shape parseFeedPath expects. */
function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface CalendarFeedData {
  id: string;
  token: string;
  /** null = whole Household Timeline. */
  sourceId: string | null;
  sourceName: string | null;
  createdAt: string;
}

export interface FeedScopeOption {
  id: string;
  name: string;
}

function toFeedData(feed: {
  id: string;
  token: string;
  calendarSourceId: string | null;
  calendarSource: { name: string } | null;
  createdAt: Date;
}): CalendarFeedData {
  return {
    id: feed.id,
    token: feed.token,
    sourceId: feed.calendarSourceId,
    sourceName: feed.calendarSource?.name ?? null,
    createdAt: feed.createdAt.toISOString(),
  };
}

const FEED_INCLUDE = {
  calendarSource: { select: { name: true } },
} as const;

/** The feeds plus the Calendar Sources available as per-source scopes. */
export async function listCalendarFeeds(): Promise<
  | { feeds: CalendarFeedData[]; sources: FeedScopeOption[] }
  | { error: string }
> {
  const userId = await getRequestUserId();
  if (!userId) return { error: "Not signed in." };

  const [feeds, sources] = await Promise.all([
    prisma.calendarFeedToken.findMany({
      where: { userId },
      include: FEED_INCLUDE,
      orderBy: { createdAt: "asc" },
    }),
    prisma.calendarSource.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { feeds: feeds.map(toFeedData), sources };
}

export async function createCalendarFeed(input: {
  /** null = whole Household Timeline; else a Calendar Source id. */
  calendarSourceId: string | null;
}): Promise<{ feed: CalendarFeedData } | { error: string }> {
  const userId = await getRequestUserId();
  if (!userId) return { error: "Not signed in." };

  if (input.calendarSourceId) {
    const source = await prisma.calendarSource.findFirst({
      where: { id: input.calendarSourceId, userId },
      select: { id: true },
    });
    if (!source) return { error: "That calendar source doesn't exist." };
  }

  const feed = await prisma.calendarFeedToken.create({
    data: {
      userId,
      token: mintToken(),
      calendarSourceId: input.calendarSourceId,
    },
    include: FEED_INCLUDE,
  });

  revalidatePath(SETTINGS_PATH);
  return { feed: toFeedData(feed) };
}

/** Rotation: same feed row, fresh token — the old URL 404s immediately. */
export async function rotateCalendarFeed(input: {
  id: string;
}): Promise<{ feed: CalendarFeedData } | { error: string }> {
  const userId = await getRequestUserId();
  if (!userId) return { error: "Not signed in." };

  const existing = await prisma.calendarFeedToken.findFirst({
    where: { id: input.id, userId },
    select: { id: true },
  });
  if (!existing) return { error: "That feed doesn't exist." };

  const feed = await prisma.calendarFeedToken.update({
    where: { id: existing.id },
    data: { token: mintToken() },
    include: FEED_INCLUDE,
  });

  revalidatePath(SETTINGS_PATH);
  return { feed: toFeedData(feed) };
}

/** Revoke = delete: every subscribed device silently stops updating. */
export async function revokeCalendarFeed(input: {
  id: string;
}): Promise<{ ok: true } | { error: string }> {
  const userId = await getRequestUserId();
  if (!userId) return { error: "Not signed in." };

  const { count } = await prisma.calendarFeedToken.deleteMany({
    where: { id: input.id, userId },
  });
  if (count === 0) return { error: "That feed doesn't exist." };

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}
