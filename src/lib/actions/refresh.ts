"use server";

import { revalidatePath } from "next/cache";

export async function refreshAppData() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/transactions/new");
  revalidatePath("/accounts");
  revalidatePath("/accounts/history");
  revalidatePath("/categories");
  revalidatePath("/settings");
}
