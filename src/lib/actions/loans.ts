"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { recordActivity } from "@/lib/actions/activity";
import { loanPaymentSnapshot } from "@/lib/activity-snapshots";

function revalidateLoans() {
  revalidatePath("/loans");
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
}

const loanPaymentSchema = z.object({
  payee: z.string().trim().min(1).max(80),
  dueDate: z.string().min(1),
  amount: z.coerce.number().positive(),
  particulars: z.string().optional(),
  remainingBalance: z.coerce.number().min(0).optional(),
  person: z.enum(["JENNA", "KENNETH", "SHARED"]),
  accountId: z.string().min(1),
  categoryId: z.string().optional(),
});

export async function createLoanPayment(formData: FormData) {
  const parsed = loanPaymentSchema.parse({
    payee: formData.get("payee"),
    dueDate: formData.get("dueDate"),
    amount: formData.get("amount"),
    particulars: formData.get("particulars") || undefined,
    remainingBalance: formData.get("remainingBalance") || undefined,
    person: formData.get("person"),
    accountId: formData.get("accountId"),
    categoryId: formData.get("categoryId") || undefined,
  });

  const loan = await prisma.loanPayment.create({
    data: {
      payee: parsed.payee,
      dueDate: new Date(parsed.dueDate),
      amount: parsed.amount,
      particulars: parsed.particulars || null,
      remainingBalance: parsed.remainingBalance ?? null,
      person: parsed.person,
      accountId: parsed.accountId,
      categoryId: parsed.categoryId || null,
    },
  });

  const activity = await recordActivity({
    entity: "LOAN_PAYMENT",
    action: "CREATE",
    entityId: loan.id,
    summary: `Added upcoming payment "${loan.payee}" (${formatMoney(parsed.amount)})`,
    after: loanPaymentSnapshot(loan),
  });

  revalidateLoans();
  return { activityId: activity.id };
}

export async function updateLoanPayment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing loan payment id." };

  const before = await prisma.loanPayment.findUnique({ where: { id } });
  if (!before) return { error: "Upcoming payment not found." };
  if (before.paid) return { error: "Unmark as paid before editing this row." };

  const parsed = loanPaymentSchema.safeParse({
    payee: formData.get("payee"),
    dueDate: formData.get("dueDate"),
    amount: formData.get("amount"),
    particulars: formData.get("particulars") || undefined,
    remainingBalance: formData.get("remainingBalance") || undefined,
    person: formData.get("person"),
    accountId: formData.get("accountId"),
    categoryId: formData.get("categoryId") || undefined,
  });
  if (!parsed.success) return { error: "Please fill in a valid amount, payee, and account." };
  const data = parsed.data;

  const loan = await prisma.loanPayment.update({
    where: { id },
    data: {
      payee: data.payee,
      dueDate: new Date(data.dueDate),
      amount: data.amount,
      particulars: data.particulars || null,
      remainingBalance: data.remainingBalance ?? null,
      person: data.person,
      accountId: data.accountId,
      categoryId: data.categoryId || null,
    },
  });

  const activity = await recordActivity({
    entity: "LOAN_PAYMENT",
    action: "UPDATE",
    entityId: id,
    summary: `Updated upcoming payment "${loan.payee}"`,
    before: loanPaymentSnapshot(before),
    after: loanPaymentSnapshot(loan),
  });

  revalidateLoans();
  return { success: true as const, activityId: activity.id };
}

export async function deleteLoanPayment(id: string) {
  const loan = await prisma.loanPayment.findUnique({ where: { id } });
  if (!loan) return { error: "Upcoming payment not found." };
  if (loan.paid) return { error: "Unmark as paid before deleting this row." };

  await prisma.loanPayment.delete({ where: { id } });

  const activity = await recordActivity({
    entity: "LOAN_PAYMENT",
    action: "DELETE",
    entityId: id,
    summary: `Deleted upcoming payment "${loan.payee}"`,
    before: loanPaymentSnapshot(loan),
  });

  revalidateLoans();
  return { activityId: activity.id };
}

/**
 * Checking a row's Status posts a real linked Transaction (so account balances
 * stay in sync); unchecking it removes that transaction again. This is a
 * compound, atomic action — not funneled through the generic undo/activity
 * log like plain row edits, since it touches two tables at once.
 */
export async function toggleLoanPaymentPaid(id: string) {
  const loan = await prisma.loanPayment.findUnique({ where: { id } });
  if (!loan) return { error: "Upcoming payment not found." };

  if (!loan.paid) {
    await prisma.$transaction(async (tx) => {
      const posted = await tx.transaction.create({
        data: {
          date: new Date(),
          entryType: "EXPENSE",
          amount: loan.amount,
          person: loan.person,
          particulars: loan.particulars ? `${loan.payee} — ${loan.particulars}` : loan.payee,
          accountId: loan.accountId,
          categoryId: loan.categoryId,
        },
      });
      await tx.loanPayment.update({
        where: { id },
        data: { paid: true, transactionId: posted.id },
      });
    });
  } else {
    const transactionId = loan.transactionId;
    await prisma.loanPayment.update({ where: { id }, data: { paid: false, transactionId: null } });
    if (transactionId) {
      await prisma.transaction.delete({ where: { id: transactionId } }).catch(() => {});
    }
  }

  revalidateLoans();
  return { paid: !loan.paid };
}
