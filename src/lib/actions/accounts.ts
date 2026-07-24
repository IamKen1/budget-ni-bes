"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const accountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["BANK", "CASH", "EWALLET"]),
});

export async function createAccount(formData: FormData) {
  const parsed = accountSchema.parse({
    name: formData.get("name"),
    type: formData.get("type"),
  });

  const count = await prisma.account.count();
  await prisma.account.create({
    data: { name: parsed.name, type: parsed.type, sortOrder: count },
  });

  revalidatePath("/accounts");
  revalidatePath("/");
}

export async function toggleArchiveAccount(id: string, archived: boolean) {
  await prisma.account.update({ where: { id }, data: { archived } });
  revalidatePath("/accounts");
  revalidatePath("/");
}

const targetSchema = z.object({
  id: z.string().min(1),
  monthlyTarget: z.coerce.number().min(0),
});

export async function updateAccountTarget(formData: FormData) {
  const parsed = targetSchema.parse({
    id: formData.get("id"),
    monthlyTarget: formData.get("monthlyTarget"),
  });

  await prisma.account.update({
    where: { id: parsed.id },
    data: { monthlyTarget: parsed.monthlyTarget },
  });

  revalidatePath("/accounts");
  revalidatePath("/");
}
