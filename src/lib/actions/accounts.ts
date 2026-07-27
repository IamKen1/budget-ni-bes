"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/actions/activity";
import { accountSnapshot } from "@/lib/activity-snapshots";

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
  const account = await prisma.account.create({
    data: { name: parsed.name, type: parsed.type, sortOrder: count },
  });

  const activity = await recordActivity({
    entity: "ACCOUNT",
    action: "CREATE",
    entityId: account.id,
    summary: `Added account "${account.name}"`,
    after: accountSnapshot(account),
  });

  revalidatePath("/accounts");
  revalidatePath("/");

  return { activityId: activity.id };
}

export async function toggleArchiveAccount(id: string, archived: boolean) {
  const before = await prisma.account.findUnique({ where: { id } });
  if (!before) return { error: "Account not found." };

  const account = await prisma.account.update({ where: { id }, data: { archived } });

  const activity = await recordActivity({
    entity: "ACCOUNT",
    action: "UPDATE",
    entityId: id,
    summary: archived ? `Archived account "${account.name}"` : `Restored account "${account.name}"`,
    before: accountSnapshot(before),
    after: accountSnapshot(account),
  });

  revalidatePath("/accounts");
  revalidatePath("/");

  return { activityId: activity.id };
}

const nameSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
});

export async function updateAccountName(formData: FormData) {
  const parsed = nameSchema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
  });

  const before = await prisma.account.findUnique({ where: { id: parsed.id } });
  if (!before) return { error: "Account not found." };

  const existing = await prisma.account.findUnique({ where: { name: parsed.name } });
  if (existing && existing.id !== parsed.id) {
    return { error: `An account named "${parsed.name}" already exists.` };
  }

  const account = await prisma.account.update({
    where: { id: parsed.id },
    data: { name: parsed.name },
  });

  const activity = await recordActivity({
    entity: "ACCOUNT",
    action: "UPDATE",
    entityId: parsed.id,
    summary: `Renamed account "${before.name}" to "${account.name}"`,
    before: accountSnapshot(before),
    after: accountSnapshot(account),
  });

  revalidatePath("/accounts");
  revalidatePath("/accounts/history");
  revalidatePath("/transactions");
  revalidatePath("/");

  return { activityId: activity.id };
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

  const before = await prisma.account.findUnique({ where: { id: parsed.id } });
  if (!before) return { error: "Account not found." };

  const account = await prisma.account.update({
    where: { id: parsed.id },
    data: { monthlyTarget: parsed.monthlyTarget },
  });

  const activity = await recordActivity({
    entity: "ACCOUNT",
    action: "UPDATE",
    entityId: parsed.id,
    summary: `Updated "${account.name}" target to ${parsed.monthlyTarget}`,
    before: accountSnapshot(before),
    after: accountSnapshot(account),
  });

  revalidatePath("/accounts");
  revalidatePath("/");

  return { activityId: activity.id };
}
