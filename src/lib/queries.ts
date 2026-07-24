import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import type { Account, Category, Person, Transaction } from "@/generated/prisma/client";

function toNumber(value: unknown): number {
  return typeof value === "object" && value !== null && "toNumber" in value
    ? (value as { toNumber: () => number }).toNumber()
    : Number(value);
}

export type DateRange = { start: Date; end: Date; label: string };

export function monthRange(reference: Date = new Date()): DateRange {
  const d = dayjs(reference);
  return {
    start: d.startOf("month").toDate(),
    end: d.endOf("month").toDate(),
    label: d.format("MMMM"),
  };
}

/**
 * Salary lands semi-monthly (1-15, 16-end) — matches the "Cutoff" column in
 * the source spreadsheet — but budget targets and reports are tracked per
 * full calendar month there, so this is only used for the "days left /
 * which cutoff we're in" hint, not for KPI aggregation.
 */
export function currentCutoffLabel(reference: Date = new Date()): string {
  const d = dayjs(reference);
  return d.date() <= 15 ? `1-15` : `16-${d.endOf("month").format("D")}`;
}

export type SerializedAccount = Omit<Account, "monthlyTarget"> & { monthlyTarget: number };

function serializeAccount(account: Account): SerializedAccount {
  return { ...account, monthlyTarget: toNumber(account.monthlyTarget) };
}

export async function getAccountsWithBalances(): Promise<
  (SerializedAccount & { balance: number })[]
> {
  const [accounts, transactions] = await Promise.all([
    prisma.account.findMany({
      where: { archived: false },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.transaction.findMany(),
  ]);

  const balances = new Map<string, number>();
  for (const account of accounts) balances.set(account.id, 0);

  for (const tx of transactions) {
    const amount = toNumber(tx.amount);
    const add = (id: string | null, delta: number) => {
      if (!id) return;
      balances.set(id, (balances.get(id) ?? 0) + delta);
    };

    switch (tx.entryType) {
      case "INCOME":
      case "SAVINGS_DEPOSIT":
        add(tx.accountId, amount);
        break;
      case "EXPENSE":
      case "SAVINGS_WITHDRAW":
        add(tx.accountId, -amount);
        break;
      case "TRANSFER":
        add(tx.accountId, -amount);
        add(tx.toAccountId, amount);
        break;
    }
  }

  return accounts.map((account) => ({
    ...serializeAccount(account),
    balance: balances.get(account.id) ?? 0,
  }));
}

export async function getTotalBalance(): Promise<number> {
  const accounts = await getAccountsWithBalances();
  return accounts.reduce((sum, a) => sum + a.balance, 0);
}

export type CategoryProgress = Omit<Category, "monthlyTarget" | "goalTarget"> & {
  monthlyTarget: number;
  goalTarget: number;
  periodTotal: number;
  allTimeTotal: number;
};

export async function getExpenseCategoriesWithProgress(
  range: DateRange = monthRange()
): Promise<CategoryProgress[]> {
  const { start, end } = range;
  const categories = await prisma.category.findMany({
    where: { kind: "EXPENSE", archived: false },
    orderBy: { sortOrder: "asc" },
    include: {
      transactions: {
        where: { entryType: "EXPENSE" },
      },
    },
  });

  return categories.map((category) => {
    let periodTotal = 0;
    let allTimeTotal = 0;
    for (const tx of category.transactions) {
      const amount = toNumber(tx.amount);
      allTimeTotal += amount;
      if (tx.date >= start && tx.date <= end) periodTotal += amount;
    }
    return { ...serializeCategory(category), periodTotal, allTimeTotal };
  });
}

export async function getSavingsCategoriesWithProgress(
  range: DateRange = monthRange()
): Promise<CategoryProgress[]> {
  const { start, end } = range;
  const categories = await prisma.category.findMany({
    where: { kind: "SAVINGS", archived: false },
    orderBy: { sortOrder: "asc" },
    include: {
      transactions: {
        where: { entryType: { in: ["SAVINGS_DEPOSIT", "SAVINGS_WITHDRAW"] } },
      },
    },
  });

  return categories.map((category) => {
    let periodTotal = 0;
    let allTimeTotal = 0;
    for (const tx of category.transactions) {
      const amount = toNumber(tx.amount);
      const signed = tx.entryType === "SAVINGS_WITHDRAW" ? -amount : amount;
      allTimeTotal += signed;
      if (tx.date >= start && tx.date <= end) periodTotal += signed;
    }
    return { ...serializeCategory(category), periodTotal, allTimeTotal };
  });
}

export async function getPeriodSummary(range: DateRange = monthRange()) {
  const { start, end } = range;
  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start, lte: end } },
  });

  let income = 0;
  let expense = 0;
  let saved = 0;

  for (const tx of transactions) {
    const amount = toNumber(tx.amount);
    if (tx.entryType === "INCOME") income += amount;
    if (tx.entryType === "EXPENSE") expense += amount;
    if (tx.entryType === "SAVINGS_DEPOSIT") saved += amount;
    if (tx.entryType === "SAVINGS_WITHDRAW") saved -= amount;
  }

  return { income, expense, saved };
}

export async function getPersonSpendBreakdown(
  range: DateRange = monthRange()
): Promise<Record<Person, number>> {
  const { start, end } = range;
  const transactions = await prisma.transaction.findMany({
    where: { entryType: "EXPENSE", date: { gte: start, lte: end } },
  });

  const totals: Record<Person, number> = { JENNA: 0, KENNETH: 0, SHARED: 0 };
  for (const tx of transactions) {
    totals[tx.person] += toNumber(tx.amount);
  }
  return totals;
}

export type SerializedTransaction = Omit<Transaction, "amount"> & {
  amount: number;
  account: SerializedAccount;
  category: SerializedCategory | null;
  toAccount: SerializedAccount | null;
};

export type SerializedCategory = Omit<Category, "monthlyTarget" | "goalTarget"> & {
  monthlyTarget: number;
  goalTarget: number;
};

function serializeTransaction<
  T extends Transaction & { account: Account; category: Category | null; toAccount: Account | null }
>(tx: T): SerializedTransaction {
  return {
    ...tx,
    amount: toNumber(tx.amount),
    account: serializeAccount(tx.account),
    category: tx.category ? serializeCategory(tx.category) : null,
    toAccount: tx.toAccount ? serializeAccount(tx.toAccount) : null,
  };
}

function serializeCategory(category: Category): SerializedCategory {
  return {
    ...category,
    monthlyTarget: toNumber(category.monthlyTarget),
    goalTarget: toNumber(category.goalTarget),
  };
}

export async function getRecentTransactions(limit = 15): Promise<SerializedTransaction[]> {
  const transactions = await prisma.transaction.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { account: true, category: true, toAccount: true },
  });
  return transactions.map(serializeTransaction);
}

export async function getAllTransactions(): Promise<SerializedTransaction[]> {
  const transactions = await prisma.transaction.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { account: true, category: true, toAccount: true },
  });
  return transactions.map(serializeTransaction);
}

export async function getAllAccounts(): Promise<SerializedAccount[]> {
  const accounts = await prisma.account.findMany({ orderBy: { sortOrder: "asc" } });
  return accounts.map(serializeAccount);
}

export async function getAllCategories(): Promise<SerializedCategory[]> {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  return categories.map(serializeCategory);
}
