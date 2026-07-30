"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/actions/activity";
import { categorySnapshot } from "@/lib/activity-snapshots";

const categorySchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["EXPENSE", "SAVINGS"]),
  monthlyTarget: z.coerce.number().min(0).optional(),
  goalTarget: z.coerce.number().min(0).optional(),
});

export async function createCategory(formData: FormData) {
  const parsed = categorySchema.parse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    monthlyTarget: formData.get("monthlyTarget") || 0,
    goalTarget: formData.get("goalTarget") || 0,
  });

  const count = await prisma.category.count({ where: { kind: parsed.kind } });
  const category = await prisma.category.create({
    data: {
      name: parsed.name,
      kind: parsed.kind,
      monthlyTarget: parsed.monthlyTarget ?? 0,
      goalTarget: parsed.goalTarget ?? 0,
      // Starts as an even split between the two cutoffs — adjustable later via
      // Edit target for categories that don't split evenly (e.g. "Jen CC").
      firstHalfTarget: (parsed.monthlyTarget ?? 0) / 2,
      sortOrder: count,
    },
  });

  const activity = await recordActivity({
    entity: "CATEGORY",
    action: "CREATE",
    entityId: category.id,
    summary: `Added category "${category.name}"`,
    after: categorySnapshot(category),
  });

  revalidatePath("/categories");
  revalidatePath("/");

  return { activityId: activity.id };
}

export async function toggleArchiveCategory(id: string, archived: boolean) {
  const before = await prisma.category.findUnique({ where: { id } });
  if (!before) return { error: "Category not found." };

  const category = await prisma.category.update({ where: { id }, data: { archived } });

  const activity = await recordActivity({
    entity: "CATEGORY",
    action: "UPDATE",
    entityId: id,
    summary: archived
      ? `Archived category "${category.name}"`
      : `Restored category "${category.name}"`,
    before: categorySnapshot(before),
    after: categorySnapshot(category),
  });

  revalidatePath("/categories");
  revalidatePath("/");

  return { activityId: activity.id };
}

const targetsSchema = z.object({
  id: z.string().min(1),
  monthlyTarget: z.coerce.number().min(0),
  goalTarget: z.coerce.number().min(0),
  // 1-15 cutoff's share of monthlyTarget (EXPENSE only) — the 16-end cutoff's
  // target is monthlyTarget - firstHalfTarget, so only one number is stored.
  firstHalfTarget: z.coerce.number().min(0).optional(),
});

export async function updateCategoryTargets(formData: FormData) {
  const parsed = targetsSchema.parse({
    id: formData.get("id"),
    monthlyTarget: formData.get("monthlyTarget"),
    goalTarget: formData.get("goalTarget"),
    firstHalfTarget: formData.get("firstHalfTarget") || undefined,
  });

  const before = await prisma.category.findUnique({ where: { id: parsed.id } });
  if (!before) return { error: "Category not found." };

  const firstHalfTarget = Math.min(parsed.firstHalfTarget ?? parsed.monthlyTarget / 2, parsed.monthlyTarget);

  const category = await prisma.category.update({
    where: { id: parsed.id },
    data: { monthlyTarget: parsed.monthlyTarget, goalTarget: parsed.goalTarget, firstHalfTarget },
  });

  const activity = await recordActivity({
    entity: "CATEGORY",
    action: "UPDATE",
    entityId: parsed.id,
    summary: `Updated "${category.name}" targets`,
    before: categorySnapshot(before),
    after: categorySnapshot(category),
  });

  revalidatePath("/categories");
  revalidatePath("/");

  return { activityId: activity.id };
}
