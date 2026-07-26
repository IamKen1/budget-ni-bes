"use server";

import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import {
  transactionSnapshot,
  accountSnapshot,
  categorySnapshot,
} from "@/lib/activity-snapshots";

type Entity = "TRANSACTION" | "ACCOUNT" | "CATEGORY";
type Action = "CREATE" | "UPDATE" | "DELETE";

export async function recordActivity(params: {
  entity: Entity;
  action: Action;
  entityId: string;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  return prisma.activityLog.create({
    data: {
      entity: params.entity,
      action: params.action,
      entityId: params.entityId,
      summary: params.summary,
      before: (params.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (params.after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getRecentActivity(limit = 20) {
  const rows = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    entity: r.entity,
    action: r.action,
    summary: r.summary,
    undone: r.undoneAt !== null,
    createdAt: r.createdAt.toISOString(),
    when: dayjs(r.createdAt).format("MMM D, h:mm A"),
  }));
}

async function undoTransaction(log: {
  entityId: string;
  action: Action;
  before: unknown;
}) {
  if (log.action === "CREATE") {
    await prisma.transaction.delete({ where: { id: log.entityId } });
    return;
  }
  const d = log.before as ReturnType<typeof transactionSnapshot>;
  const data = {
    date: new Date(d.date),
    entryType: d.entryType as never,
    amount: d.amount,
    person: d.person as never,
    particulars: d.particulars,
    accountId: d.accountId,
    categoryId: d.categoryId,
    toAccountId: d.toAccountId,
  };
  if (log.action === "DELETE") {
    await prisma.transaction.create({ data: { id: log.entityId, ...data } });
  } else {
    await prisma.transaction.update({ where: { id: log.entityId }, data });
  }
}

async function undoAccount(log: { entityId: string; action: Action; before: unknown }) {
  if (log.action === "CREATE") {
    await prisma.account.delete({ where: { id: log.entityId } });
    return;
  }
  const d = log.before as ReturnType<typeof accountSnapshot>;
  const data = {
    name: d.name,
    type: d.type as never,
    archived: d.archived,
    sortOrder: d.sortOrder,
    monthlyTarget: d.monthlyTarget,
  };
  if (log.action === "DELETE") {
    await prisma.account.create({ data: { id: log.entityId, ...data } });
  } else {
    await prisma.account.update({ where: { id: log.entityId }, data });
  }
}

async function undoCategory(log: { entityId: string; action: Action; before: unknown }) {
  if (log.action === "CREATE") {
    await prisma.category.delete({ where: { id: log.entityId } });
    return;
  }
  const d = log.before as ReturnType<typeof categorySnapshot>;
  const data = {
    name: d.name,
    kind: d.kind as never,
    monthlyTarget: d.monthlyTarget,
    goalTarget: d.goalTarget,
    archived: d.archived,
    sortOrder: d.sortOrder,
  };
  if (log.action === "DELETE") {
    await prisma.category.create({ data: { id: log.entityId, ...data } });
  } else {
    await prisma.category.update({ where: { id: log.entityId }, data });
  }
}

export async function undoActivity(id: string): Promise<{ success?: true; error?: string }> {
  const log = await prisma.activityLog.findUnique({ where: { id } });
  if (!log) return { error: "Action not found." };
  if (log.undoneAt) return { error: "Already undone." };

  try {
    if (log.entity === "TRANSACTION") {
      await undoTransaction(log);
    } else if (log.entity === "ACCOUNT") {
      await undoAccount(log);
    } else {
      await undoCategory(log);
    }
  } catch {
    return { error: "Could not undo — related data may have changed since." };
  }

  await prisma.activityLog.update({ where: { id }, data: { undoneAt: new Date() } });

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/categories");
  revalidatePath("/settings");

  return { success: true };
}
