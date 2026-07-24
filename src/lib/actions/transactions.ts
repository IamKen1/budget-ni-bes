"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

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

export async function createTransaction(formData: FormData) {
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

  await prisma.transaction.create({
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

  revalidatePath("/");
  revalidatePath("/transactions");
  redirect("/transactions");
}

export async function deleteTransaction(id: string) {
  await prisma.transaction.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/transactions");
}
