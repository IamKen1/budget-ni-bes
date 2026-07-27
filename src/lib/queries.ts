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

export type MonthlyBalanceRow = {
  monthKey: string;
  label: string;
  balances: Record<string, number>;
};

/**
 * Account balances are a running total, never reset at month end (like a real bank
 * account) — there's no stored "closing balance" anywhere. This reconstructs what the
 * balance was as of the end of each past month by replaying transactions in date order
 * and snapshotting the running totals whenever a month boundary is crossed.
 */
export async function getMonthlyAccountBalanceHistory(): Promise<{
  accounts: SerializedAccount[];
  rows: MonthlyBalanceRow[];
}> {
  const [accounts, transactions] = await Promise.all([
    prisma.account.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.transaction.findMany({ orderBy: { date: "asc" } }),
  ]);

  const serialized = accounts.map(serializeAccount);
  if (transactions.length === 0) {
    return { accounts: serialized, rows: [] };
  }

  const running = new Map<string, number>();
  for (const a of accounts) running.set(a.id, 0);

  const apply = (tx: (typeof transactions)[number]) => {
    const amount = toNumber(tx.amount);
    const add = (id: string | null, delta: number) => {
      if (!id) return;
      running.set(id, (running.get(id) ?? 0) + delta);
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
  };

  const firstMonth = dayjs(transactions[0].date).startOf("month");
  const lastMonth = dayjs().startOf("month");

  const rows: MonthlyBalanceRow[] = [];
  let txIndex = 0;
  let cursor = firstMonth;
  while (cursor.valueOf() <= lastMonth.valueOf()) {
    const monthEndMs = cursor.endOf("month").valueOf();
    while (txIndex < transactions.length && transactions[txIndex].date.getTime() <= monthEndMs) {
      apply(transactions[txIndex]);
      txIndex++;
    }
    rows.push({
      monthKey: cursor.format("YYYY-MM"),
      label: cursor.format("MMMM YYYY"),
      balances: Object.fromEntries(accounts.map((a) => [a.id, running.get(a.id) ?? 0])),
    });
    cursor = cursor.add(1, "month");
  }

  return { accounts: serialized, rows: rows.reverse() };
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

  return categories.map(({ transactions, ...category }) => {
    let periodTotal = 0;
    let allTimeTotal = 0;
    for (const tx of transactions) {
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

  return categories.map(({ transactions, ...category }) => {
    let periodTotal = 0;
    let allTimeTotal = 0;
    for (const tx of transactions) {
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
  /// Running total balance across all accounts right after this transaction. Only populated by getAllTransactions.
  runningBalance?: number;
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

export async function getAllTransactions(filter?: {
  accountId?: string;
  categoryId?: string;
}): Promise<SerializedTransaction[]> {
  const transactions = await prisma.transaction.findMany({
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { account: true, category: true, toAccount: true },
  });

  // Running balance is per-account (like a real bank statement line), computed
  // over the full, unfiltered history in date order, then read back out for
  // each transaction's own account — not one blended total across accounts.
  const balances = new Map<string, number>();
  const balanceOf = (id: string) => balances.get(id) ?? 0;

  const withBalance = transactions.map((tx) => {
    const amount = toNumber(tx.amount);
    if (tx.entryType === "TRANSFER") {
      balances.set(tx.accountId, balanceOf(tx.accountId) - amount);
      if (tx.toAccountId) balances.set(tx.toAccountId, balanceOf(tx.toAccountId) + amount);
    } else if (tx.entryType === "INCOME" || tx.entryType === "SAVINGS_DEPOSIT") {
      balances.set(tx.accountId, balanceOf(tx.accountId) + amount);
    } else if (tx.entryType === "EXPENSE" || tx.entryType === "SAVINGS_WITHDRAW") {
      balances.set(tx.accountId, balanceOf(tx.accountId) - amount);
    }
    return { ...serializeTransaction(tx), runningBalance: balanceOf(tx.accountId) };
  });

  const filtered = withBalance.filter((tx) => {
    if (filter?.accountId && tx.accountId !== filter.accountId && tx.toAccountId !== filter.accountId) {
      return false;
    }
    if (filter?.categoryId && tx.categoryId !== filter.categoryId) return false;
    return true;
  });

  return filtered.reverse();
}

export async function getAllAccounts(): Promise<SerializedAccount[]> {
  const accounts = await prisma.account.findMany({ orderBy: { sortOrder: "asc" } });
  return accounts.map(serializeAccount);
}

export async function getAllCategories(): Promise<SerializedCategory[]> {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  return categories.map(serializeCategory);
}
