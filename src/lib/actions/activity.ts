"use server";

import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { isValidPasscode } from "@/lib/auth";
import {
  transactionSnapshot,
  accountSnapshot,
  categorySnapshot,
  loanPaymentSnapshot,
} from "@/lib/activity-snapshots";

type Entity = "TRANSACTION" | "ACCOUNT" | "CATEGORY" | "LOAN_PAYMENT";
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

export async function getRecentActivity(page = 1, pageSize = 5) {
  const skip = (Math.max(1, page) - 1) * pageSize;
  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.activityLog.count(),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      entity: r.entity,
      action: r.action,
      summary: r.summary,
      undone: r.undoneAt !== null,
      createdAt: r.createdAt.toISOString(),
      when: dayjs(r.createdAt).format("MMM D, h:mm A"),
    })),
    page: Math.max(1, page),
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
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
    isSalaryIncome: d.isSalaryIncome,
    periodOverride: d.periodOverride ? new Date(d.periodOverride) : null,
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
    openingBalance: d.openingBalance,
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
    firstHalfTarget: d.firstHalfTarget,
    archived: d.archived,
    sortOrder: d.sortOrder,
  };
  if (log.action === "DELETE") {
    await prisma.category.create({ data: { id: log.entityId, ...data } });
  } else {
    await prisma.category.update({ where: { id: log.entityId }, data });
  }
}

async function undoLoanPayment(log: { entityId: string; action: Action; before: unknown }) {
  if (log.action === "CREATE") {
    await prisma.loanPayment.delete({ where: { id: log.entityId } });
    return;
  }
  const d = log.before as ReturnType<typeof loanPaymentSnapshot>;
  const data = {
    payee: d.payee,
    dueDate: new Date(d.dueDate),
    amount: d.amount,
    particulars: d.particulars,
    remainingBalance: d.remainingBalance,
    person: d.person as never,
    paid: d.paid,
    sortOrder: d.sortOrder,
    accountId: d.accountId,
    categoryId: d.categoryId,
    transactionId: d.transactionId,
  };
  if (log.action === "DELETE") {
    await prisma.loanPayment.create({ data: { id: log.entityId, ...data } });
  } else {
    await prisma.loanPayment.update({ where: { id: log.entityId }, data });
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
    } else if (log.entity === "CATEGORY") {
      await undoCategory(log);
    } else {
      await undoLoanPayment(log);
    }
  } catch {
    return { error: "Could not undo — related data may have changed since." };
  }

  await prisma.activityLog.update({ where: { id }, data: { undoneAt: new Date() } });

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/categories");
  revalidatePath("/loans");
  revalidatePath("/settings");

  return { success: true };
}

/**
 * Irreversible: wipes every transaction (accounts, categories, and their
 * targets are kept, so balances just reset to zero) plus the transaction
 * activity log, since those entries would otherwise point at rows that no
 * longer exist. Gated on the app passcode + a literal "DELETE" confirmation
 * on the client — this bypasses the normal undo system entirely.
 */
export async function clearAllTransactions(
  passcode: string,
  confirmation: string
): Promise<{ success?: true; error?: string }> {
  if (confirmation !== "DELETE") {
    return { error: 'Type "DELETE" exactly to confirm.' };
  }
  if (!(await isValidPasscode(passcode))) {
    return { error: "Wrong passcode." };
  }

  await prisma.$transaction([
    prisma.transaction.deleteMany({}),
    prisma.activityLog.deleteMany({ where: { entity: "TRANSACTION" } }),
  ]);

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/categories");
  revalidatePath("/settings");

  return { success: true };
}
