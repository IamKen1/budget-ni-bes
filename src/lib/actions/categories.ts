"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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
  await prisma.category.create({
    data: {
      name: parsed.name,
      kind: parsed.kind,
      monthlyTarget: parsed.monthlyTarget ?? 0,
      goalTarget: parsed.goalTarget ?? 0,
      sortOrder: count,
    },
  });

  revalidatePath("/categories");
  revalidatePath("/");
}

export async function toggleArchiveCategory(id: string, archived: boolean) {
  await prisma.category.update({ where: { id }, data: { archived } });
  revalidatePath("/categories");
  revalidatePath("/");
}

const targetsSchema = z.object({
  id: z.string().min(1),
  monthlyTarget: z.coerce.number().min(0),
  goalTarget: z.coerce.number().min(0),
});

export async function updateCategoryTargets(formData: FormData) {
  const parsed = targetsSchema.parse({
    id: formData.get("id"),
    monthlyTarget: formData.get("monthlyTarget"),
    goalTarget: formData.get("goalTarget"),
  });

  await prisma.category.update({
    where: { id: parsed.id },
    data: { monthlyTarget: parsed.monthlyTarget, goalTarget: parsed.goalTarget },
  });

  revalidatePath("/categories");
  revalidatePath("/");
}
