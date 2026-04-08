"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export type AutomationCategoryValue =
  | "BILL_PAY"
  | "SAVINGS_TRANSFER"
  | "INVESTMENT_TRANSFER"
  | "CREDIT_PROTECTION"
  | "CREDIT_MONITORING";

export interface AutomationItemData {
  id: string;
  title: string;
  description: string | null;
  isCompleted: boolean;
  category: AutomationCategoryValue;
}

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function loadAutomationItems(): Promise<AutomationItemData[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const items = await prisma.automationItem.findMany({
    where: { userId },
    orderBy: [{ isCompleted: "asc" }, { createdAt: "asc" }],
  });

  return items.map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    isCompleted: i.isCompleted,
    category: i.category as AutomationCategoryValue,
  }));
}

export async function addAutomationItem(input: {
  title: string;
  description?: string;
  category: AutomationCategoryValue;
}) {
  const userId = await getUserId();
  if (!userId) return null;

  const item = await prisma.automationItem.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      isCompleted: false,
    },
  });

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    isCompleted: item.isCompleted,
    category: item.category as AutomationCategoryValue,
  };
}

export async function toggleAutomationItem(id: string, isCompleted: boolean) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.automationItem.updateMany({
    where: { id, userId },
    data: { isCompleted },
  });
}

export async function removeAutomationItem(id: string) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.automationItem.deleteMany({
    where: { id, userId },
  });
}
