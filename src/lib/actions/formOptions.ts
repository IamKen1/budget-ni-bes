"use server";

import { getAllAccounts, getAllCategories } from "@/lib/queries";

export async function getTransactionFormOptions() {
  const [accounts, categories] = await Promise.all([getAllAccounts(), getAllCategories()]);
  return {
    accounts: accounts.filter((a) => !a.archived),
    categories: categories.filter((c) => !c.archived),
  };
}
