import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import type { Account, Category, LoanPayment, Person, Transaction } from "@/generated/prisma/client";

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
// Labeled "1-15" / "16-end" (matching how the family names them in their own
// spreadsheet), but day 15 itself actually belongs to the second bucket —
// salary reliably lands ON the 15th and funds spending through month-end, per
// the family's own ledger (day-15 entries are filed under "16-31 Cutoff" there)
// and their stated rule: money received in a 16-31 cutoff funds the next
// month's 1-15 spending, and money received in a 1-15 cutoff funds that same
// month's 15-31 spending. So the real boundary is day <= 14 vs day >= 15.
export function currentCutoffLabel(reference: Date = new Date()): string {
  const d = dayjs(reference);
  return d.date() <= 14 ? `1-15` : `16-${d.endOf("month").format("D")}`;
}

/** The current semi-monthly cutoff period (1-15 or 16-end) as a DateRange, for
 * dashboards that want to scope KPIs to the current cutoff instead of the
 * full calendar month. See currentCutoffLabel for the underlying schedule and
 * why day 15 itself is grouped into the second half despite the "1-15" label. */
export function cutoffRange(reference: Date = new Date()): DateRange {
  const d = dayjs(reference);
  const monthLabel = d.format("MMMM");
  if (d.date() <= 14) {
    return {
      start: d.startOf("month").toDate(),
      end: d.startOf("month").add(13, "day").endOf("day").toDate(),
      label: `${monthLabel} 1-15`,
    };
  }
  return {
    start: d.startOf("month").add(14, "day").toDate(),
    end: d.endOf("month").toDate(),
    label: `${monthLabel} 16-${d.endOf("month").format("D")}`,
  };
}

// Loan due dates (and other "which cutoff is this due in" questions) group the
// plain, literal way — "1-15" means days 1 through 15 inclusive. Deliberately
// NOT the same boundary as cutoffRange() above, which shifts day 15 into the
// second half because that's when salary lands and starts funding the rest of
// the month. A bill due on the 15th still reads as "due within 1-15" to a
// human at a glance, so this uses its own literal grouping.
export function literalCutoffHalf(date: Date): "1-15" | "16-31" {
  return dayjs(date).date() <= 15 ? "1-15" : "16-31";
}

export type SerializedAccount = Omit<Account, "monthlyTarget" | "openingBalance"> & {
  monthlyTarget: number;
  openingBalance: number;
};

function serializeAccount(account: Account): SerializedAccount {
  return {
    ...account,
    monthlyTarget: toNumber(account.monthlyTarget),
    openingBalance: toNumber(account.openingBalance),
  };
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
  for (const account of accounts) balances.set(account.id, toNumber(account.openingBalance));

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
  for (const a of accounts) running.set(a.id, toNumber(a.openingBalance));

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

export type CategoryProgress = Omit<Category, "monthlyTarget" | "goalTarget" | "firstHalfTarget"> & {
  monthlyTarget: number;
  goalTarget: number;
  firstHalfTarget: number;
  /// The target to compare periodTotal against for whatever range was passed in —
  /// monthlyTarget for a full month, or the correct half (firstHalfTarget, or
  /// monthlyTarget - firstHalfTarget) when range is a single cutoff.
  periodTarget: number;
  periodTotal: number;
  allTimeTotal: number;
};

// Which cutoff/month a transaction counts toward — periodOverride when set
// (e.g. salary landing on the last day of a cutoff but meant for the next
// one), otherwise its real date. Never used for balance/running-total math,
// only for period-scoped summaries (Deposits, budget progress, etc).
function effectiveDate(tx: { date: Date; periodOverride: Date | null }): Date {
  return tx.periodOverride ?? tx.date;
}

export type TargetScope = "month" | "first-half" | "second-half";

function periodTargetFor(scope: TargetScope, monthlyTarget: number, firstHalfTarget: number): number {
  if (scope === "first-half") return firstHalfTarget;
  if (scope === "second-half") return monthlyTarget - firstHalfTarget;
  return monthlyTarget;
}

export async function getExpenseCategoriesWithProgress(
  range: DateRange = monthRange(),
  targetScope: TargetScope = "month"
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
      const d = effectiveDate(tx);
      if (d >= start && d <= end) periodTotal += amount;
    }
    const serialized = serializeCategory(category);
    const periodTarget = periodTargetFor(targetScope, serialized.monthlyTarget, serialized.firstHalfTarget);
    return { ...serialized, periodTotal, allTimeTotal, periodTarget };
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
      const d = effectiveDate(tx);
      if (d >= start && d <= end) periodTotal += signed;
    }
    const serialized = serializeCategory(category);
    return { ...serialized, periodTotal, allTimeTotal, periodTarget: serialized.monthlyTarget };
  });
}

export async function getPeriodSummary(range: DateRange = monthRange()) {
  const { start, end } = range;
  // OR on periodOverride too — a transaction dated outside this range can still
  // count toward it (or vice versa: dated inside but overridden elsewhere), so
  // the DB fetch has to be a superset; effectiveDate() below decides for real.
  const transactions = await prisma.transaction.findMany({
    where: { OR: [{ date: { gte: start, lte: end } }, { periodOverride: { gte: start, lte: end } }] },
  });

  let income = 0;
  let allIncome = 0;
  let expense = 0;
  let saved = 0;

  for (const tx of transactions) {
    const d = effectiveDate(tx);
    if (d < start || d > end) continue;
    const amount = toNumber(tx.amount);
    // "Deposits" is deliberately narrower than every INCOME transaction — it's
    // only real salary landing in an account. Interest, reimbursements, savings
    // withdrawn back into spending money, and one-off balance adjustments are
    // all logged as INCOME too (for correct account balances) but aren't what
    // the family means by "Deposits", so they're excluded here. allIncome is
    // every INCOME transaction, unfiltered — used for cash-flow math (e.g.
    // "extra money": real money in vs. real money out this period) where the
    // salary-only distinction doesn't apply, matching the family's own sheet.
    if (tx.entryType === "INCOME") {
      allIncome += amount;
      if (tx.isSalaryIncome) income += amount;
    }
    if (tx.entryType === "EXPENSE") expense += amount;
    if (tx.entryType === "SAVINGS_DEPOSIT") saved += amount;
    if (tx.entryType === "SAVINGS_WITHDRAW") saved -= amount;
  }

  return { income, allIncome, expense, saved };
}

// The family's own cutoff summary only ever tracks Maribank + Cash on Hand —
// their two "spending money" accounts. BPI Joint/BPI CC Payment are savings
// and credit-card-payment accounts respectively, deliberately excluded from
// this cash-flow figure (matches their sheet's "1-15 CUTOFF" tab, which has
// no BPI column at all).
const SPENDING_ACCOUNT_NAMES = ["Maribank", "Cash on Hand"];

/** Income/expense cash flow for this period, restricted to the spending-money
 * accounts (Maribank + Cash on Hand) — the basis for "Extra Money", matching
 * the family's own sheet exactly (their REMAINING row never touches BPI). */
export async function getSpendingAccountsCashFlow(range: DateRange = monthRange()) {
  const { start, end } = range;
  const accounts = await prisma.account.findMany({ where: { name: { in: SPENDING_ACCOUNT_NAMES } } });
  const accountIds = accounts.map((a) => a.id);

  const transactions = await prisma.transaction.findMany({
    where: {
      accountId: { in: accountIds },
      entryType: { in: ["INCOME", "EXPENSE"] },
      OR: [{ date: { gte: start, lte: end } }, { periodOverride: { gte: start, lte: end } }],
    },
  });

  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    const d = effectiveDate(tx);
    if (d < start || d > end) continue;
    const amount = toNumber(tx.amount);
    if (tx.entryType === "INCOME") income += amount;
    if (tx.entryType === "EXPENSE") expense += amount;
  }

  return { income, expense };
}

/** All-time net balance of a single savings category by name — used for funds
 * that sit outside the normal spending/category flow (e.g. "Daddy" ipon). */
export async function getSavingsCategoryBalance(name: string): Promise<number> {
  const category = await prisma.category.findUnique({
    where: { name },
    include: { transactions: { where: { entryType: { in: ["SAVINGS_DEPOSIT", "SAVINGS_WITHDRAW"] } } } },
  });
  if (!category) return 0;
  let total = 0;
  for (const tx of category.transactions) {
    const amount = toNumber(tx.amount);
    total += tx.entryType === "SAVINGS_WITHDRAW" ? -amount : amount;
  }
  return total;
}

export async function getPersonSpendBreakdown(
  range: DateRange = monthRange()
): Promise<Record<Person, number>> {
  const { start, end } = range;
  const transactions = await prisma.transaction.findMany({
    where: {
      entryType: "EXPENSE",
      OR: [{ date: { gte: start, lte: end } }, { periodOverride: { gte: start, lte: end } }],
    },
  });

  const totals: Record<Person, number> = { JENNA: 0, KENNETH: 0, SHARED: 0 };
  for (const tx of transactions) {
    const d = effectiveDate(tx);
    if (d < start || d > end) continue;
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

export type SerializedCategory = Omit<Category, "monthlyTarget" | "goalTarget" | "firstHalfTarget"> & {
  monthlyTarget: number;
  goalTarget: number;
  firstHalfTarget: number;
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
    firstHalfTarget: toNumber(category.firstHalfTarget),
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
  entryType?: string;
  from?: Date;
  to?: Date;
}): Promise<SerializedTransaction[]> {
  const [transactions, accounts] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: { account: true, category: true, toAccount: true },
    }),
    prisma.account.findMany(),
  ]);

  // Running balance is per-account (like a real bank statement line), computed
  // over the full, unfiltered history in date order, then read back out for
  // each transaction's own account — not one blended total across accounts.
  const balances = new Map<string, number>(accounts.map((a) => [a.id, toNumber(a.openingBalance)]));
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
    if (filter?.entryType && tx.entryType !== filter.entryType) return false;
    // periodOverride-aware — a transaction dated outside from/to can still belong
    // here (e.g. salary dated the last day of a cutoff but meant for the next
    // one), matching how getPeriodSummary/getExpenseCategoriesWithProgress
    // already scope things. Without this, a period's drill-down list can miss
    // (or wrongly include) exactly the transactions its own total accounts for.
    if (filter?.from || filter?.to) {
      const d = effectiveDate(tx);
      if (filter.from && d < filter.from) return false;
      if (filter.to && d > filter.to) return false;
    }
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

export type SerializedLoanPayment = Omit<LoanPayment, "amount" | "remainingBalance"> & {
  amount: number;
  remainingBalance: number | null;
  account: SerializedAccount;
  category: SerializedCategory | null;
};

function serializeLoanPayment<
  T extends LoanPayment & { account: Account; category: Category | null }
>(loan: T): SerializedLoanPayment {
  return {
    ...loan,
    amount: toNumber(loan.amount),
    remainingBalance: loan.remainingBalance === null ? null : toNumber(loan.remainingBalance),
    account: serializeAccount(loan.account),
    category: loan.category ? serializeCategory(loan.category) : null,
  };
}

export type LoanPaymentMonthGroup = {
  monthKey: string;
  label: string;
  total: number;
  remainingBalance: number;
  payments: SerializedLoanPayment[];
};

/** All upcoming loan/bill installments, grouped by due-date month — newest month first (matches the "Upcoming Payments" schedule). */
export async function getLoanPaymentsByMonth(): Promise<LoanPaymentMonthGroup[]> {
  const loans = await prisma.loanPayment.findMany({
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
    include: { account: true, category: true },
  });

  const groups = new Map<string, LoanPaymentMonthGroup>();
  for (const loan of loans) {
    const serialized = serializeLoanPayment(loan);
    const monthKey = dayjs(loan.dueDate).format("YYYY-MM");
    let group = groups.get(monthKey);
    if (!group) {
      group = {
        monthKey,
        label: dayjs(loan.dueDate).format("MMMM YYYY"),
        total: 0,
        remainingBalance: 0,
        payments: [],
      };
      groups.set(monthKey, group);
    }
    group.total += serialized.amount;
    group.remainingBalance += serialized.remainingBalance ?? 0;
    group.payments.push(serialized);
  }

  return Array.from(groups.values());
}
