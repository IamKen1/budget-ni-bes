"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { recordActivity } from "@/lib/actions/activity";
import { transactionSnapshot } from "@/lib/activity-snapshots";

const transactionSchema = z.object({
  date: z.string().min(1),
  entryType: z.enum(["INCOME", "EXPENSE", "SAVINGS_DEPOSIT", "SAVINGS_WITHDRAW", "TRANSFER"]),
  amount: z.coerce.number().positive(),
  person: z.enum(["JENNA", "KENNETH", "SHARED"]),
  particulars: z.string().optional(),
  accountId: z.string().min(1),
  categoryId: z.string().optional(),
  toAccountId: z.string().optional(),
});

async function insertTransaction(formData: FormData) {
  const parsed = transactionSchema.parse({
    date: formData.get("date"),
    entryType: formData.get("entryType"),
    amount: formData.get("amount"),
    person: formData.get("person"),
    particulars: formData.get("particulars") || undefined,
    accountId: formData.get("accountId"),
    categoryId: formData.get("categoryId") || undefined,
    toAccountId: formData.get("toAccountId") || undefined,
  });

  const tx = await prisma.transaction.create({
    data: {
      date: new Date(parsed.date),
      entryType: parsed.entryType,
      amount: parsed.amount,
      person: parsed.person,
      particulars: parsed.particulars || null,
      accountId: parsed.accountId,
      categoryId: parsed.entryType === "TRANSFER" ? null : parsed.categoryId || null,
      toAccountId: parsed.entryType === "TRANSFER" ? parsed.toAccountId || null : null,
    },
  });

  const activity = await recordActivity({
    entity: "TRANSACTION",
    action: "CREATE",
    entityId: tx.id,
    summary: `Logged ${formatMoney(parsed.amount)} ${parsed.entryType.toLowerCase().replace("_", " ")}`,
    after: transactionSnapshot(tx),
  });

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/categories");

  return activity.id;
}

export async function createTransaction(formData: FormData) {
  const activityId = await insertTransaction(formData);
  redirect(`/transactions?logged=${activityId}`);
}

/** Same as createTransaction but for the always-visible desktop quick-add form — stays on the page instead of redirecting. */
export async function quickAddTransaction(formData: FormData) {
  try {
    const activityId = await insertTransaction(formData);
    return { activityId };
  } catch {
    return { error: "Could not save that transaction. Check the amount and try again." };
  }
}

export async function deleteTransaction(id: string) {
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) return { error: "Transaction not found." };

  await prisma.transaction.delete({ where: { id } });

  const activity = await recordActivity({
    entity: "TRANSACTION",
    action: "DELETE",
    entityId: id,
    summary: `Deleted ${formatMoney(Number(tx.amount))} ${tx.entryType.toLowerCase().replace("_", " ")}`,
    before: transactionSnapshot(tx),
  });

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/categories");

  return { activityId: activity.id };
}
