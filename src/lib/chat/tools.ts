import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import {
  getAccountsWithBalances,
  getExpenseCategoriesWithProgress,
  monthRange,
} from "@/lib/queries";
import { recordActivity } from "@/lib/actions/activity";
import { transactionSnapshot } from "@/lib/activity-snapshots";

function toNumber(value: unknown): number {
  return typeof value === "object" && value !== null && "toNumber" in value
    ? (value as { toNumber: () => number }).toNumber()
    : Number(value);
}

type Period = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "all";

function periodRange(period: Period) {
  const now = dayjs();
  switch (period) {
    case "today":
      return { start: now.startOf("day").toDate(), end: now.endOf("day").toDate() };
    case "yesterday": {
      const y = now.subtract(1, "day");
      return { start: y.startOf("day").toDate(), end: y.endOf("day").toDate() };
    }
    case "this_week":
      return { start: now.startOf("week").toDate(), end: now.endOf("week").toDate() };
    case "last_month": {
      const m = now.subtract(1, "month");
      return { start: m.startOf("month").toDate(), end: m.endOf("month").toDate() };
    }
    case "this_month":
      return { start: now.startOf("month").toDate(), end: now.endOf("month").toDate() };
    case "all":
    default:
      return { start: new Date(2000, 0, 1), end: now.endOf("day").toDate() };
  }
}

export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "get_balances",
      description: "Get the current balance of every account (bank, cash, e-wallet) and the total across all accounts.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_spending",
      description:
        "Get expense transactions for a time period, optionally filtered by who spent it. Returns the total, a per-category breakdown, and the list of transactions.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "yesterday", "this_week", "this_month", "last_month", "all"],
            description: "The time period to look at.",
          },
          person: {
            type: "string",
            enum: ["JENNA", "KENNETH", "SHARED", "ALL"],
            description: "Filter by who spent it. Use ALL for everyone.",
          },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_budget_progress",
      description:
        "Get this month's expense categories with their monthly target, how much has been spent so far, and how much is left.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "log_transaction",
      description:
        "Record a new transaction (expense, income, savings deposit/withdraw, or transfer) in the budget tracker. For EXPENSE/SAVINGS entries, if categoryName is omitted and there's no learned match for the note, this returns needsCategory instead of saving — ask the user which category, then call again with categoryName (and learnKeyword to remember it).",
      parameters: {
        type: "object",
        properties: {
          entryType: {
            type: "string",
            enum: ["EXPENSE", "INCOME", "SAVINGS_DEPOSIT", "SAVINGS_WITHDRAW"],
          },
          amount: { type: "number", description: "Peso amount, positive number." },
          accountName: {
            type: "string",
            description: "Which account the money moved through, e.g. 'Maribank', 'BPI', 'Cash on Hand'. Defaults to Maribank if unsure.",
          },
          categoryName: {
            type: "string",
            description: "Category name for EXPENSE or SAVINGS entries, e.g. 'Grocery', 'Jen CC', 'Emergency Fund'. Omit for INCOME. If you don't know it yet, omit it and ask the user first.",
          },
          learnKeyword: {
            type: "string",
            description:
              "Only set this on the follow-up call, right after the user told you which category to use for something ambiguous (e.g. 'reunion' or 'javier'). A short keyword from the note to remember for next time — pick something specific enough it won't misfire on unrelated notes.",
          },
          person: {
            type: "string",
            enum: ["JENNA", "KENNETH", "SHARED"],
            description: "Who this is for. Default SHARED if unclear.",
          },
          note: { type: "string", description: "Optional short note, e.g. what was bought." },
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format. Defaults to today if omitted.",
          },
        },
        required: ["entryType", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_transactions",
      description:
        "Search existing transactions to find the one(s) the user wants to fix, edit, or delete. Use this before update_transaction or delete_transaction to get the exact transaction id — never guess an id.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "yesterday", "this_week", "this_month", "last_month", "all"],
            description: "The time period to look in. Default 'all' if unsure.",
          },
          keyword: {
            type: "string",
            description: "Text to match against the note/particulars or category name, e.g. 'javier reunion'.",
          },
          person: {
            type: "string",
            enum: ["JENNA", "KENNETH", "SHARED", "ALL"],
          },
          limit: { type: "number", description: "Max results, default 10." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_transaction",
      description:
        "Edit an existing transaction to correct a mistake (wrong amount, category, account, date, person, or note). Only include the fields that should change. Always confirm the exact change with the user before calling this — describe what will change and wait for them to say yes.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The transaction id from find_transactions." },
          amount: { type: "number" },
          entryType: {
            type: "string",
            enum: ["EXPENSE", "INCOME", "SAVINGS_DEPOSIT", "SAVINGS_WITHDRAW"],
          },
          accountName: { type: "string" },
          categoryName: { type: "string" },
          person: { type: "string", enum: ["JENNA", "KENNETH", "SHARED"] },
          note: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_transaction",
      description:
        "Permanently remove a transaction, e.g. a duplicate or one logged by mistake. Always confirm exactly which transaction (amount, date, note) with the user before calling this — describe it and wait for them to say yes.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The transaction id from find_transactions." },
        },
        required: ["id"],
      },
    },
  },
] as const;

async function toolGetBalances() {
  const accounts = await getAccountsWithBalances();
  return {
    total: accounts.reduce((s, a) => s + a.balance, 0),
    accounts: accounts.map((a) => ({ name: a.name, type: a.type, balance: a.balance })),
  };
}

async function toolGetSpending(args: { period: Period; person?: string }) {
  const { start, end } = periodRange(args.period);
  const where: Record<string, unknown> = {
    entryType: "EXPENSE",
    date: { gte: start, lte: end },
  };
  if (args.person && args.person !== "ALL") where.person = args.person;

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true, account: true },
    orderBy: { date: "desc" },
  });

  const byCategory = new Map<string, number>();
  let total = 0;
  for (const tx of transactions) {
    const amount = toNumber(tx.amount);
    total += amount;
    const key = tx.category?.name ?? tx.particulars ?? "Others";
    byCategory.set(key, (byCategory.get(key) ?? 0) + amount);
  }

  return {
    period: args.period,
    total,
    totalFormatted: formatMoney(total),
    byCategory: Array.from(byCategory.entries()).map(([name, amount]) => ({
      name,
      amount,
      formatted: formatMoney(amount),
    })),
    transactions: transactions.slice(0, 25).map((tx) => ({
      date: dayjs(tx.date).format("YYYY-MM-DD"),
      amount: toNumber(tx.amount),
      category: tx.category?.name ?? null,
      account: tx.account.name,
      person: tx.person,
      note: tx.particulars,
    })),
  };
}

async function toolGetBudgetProgress() {
  const categories = await getExpenseCategoriesWithProgress(monthRange());
  return categories
    .filter((c) => c.monthlyTarget > 0 || c.periodTotal > 0)
    .map((c) => ({
      category: c.name,
      target: c.monthlyTarget,
      spent: c.periodTotal,
      remaining: c.monthlyTarget - c.periodTotal,
      overBudget: c.monthlyTarget > 0 && c.periodTotal > c.monthlyTarget,
    }));
}

async function toolLogTransaction(args: {
  entryType: "EXPENSE" | "INCOME" | "SAVINGS_DEPOSIT" | "SAVINGS_WITHDRAW";
  amount: number;
  accountName?: string;
  categoryName?: string;
  learnKeyword?: string;
  person?: "JENNA" | "KENNETH" | "SHARED";
  note?: string;
  date?: string;
}) {
  if (!args.amount || args.amount <= 0) {
    return { error: "Amount must be a positive number." };
  }

  const accounts = await prisma.account.findMany({ where: { archived: false } });
  const account =
    accounts.find((a) => a.name.toLowerCase() === (args.accountName ?? "").toLowerCase()) ??
    accounts.find((a) => a.name.toLowerCase().includes((args.accountName ?? "").toLowerCase())) ??
    accounts.find((a) => a.name === "Maribank") ??
    accounts[0];

  if (!account) return { error: "No account found to log this against." };

  let categoryId: string | null = null;
  if (args.entryType === "EXPENSE" || args.entryType === "SAVINGS_DEPOSIT" || args.entryType === "SAVINGS_WITHDRAW") {
    const kind = args.entryType === "EXPENSE" ? "EXPENSE" : "SAVINGS";
    const categories = await prisma.category.findMany({ where: { archived: false, kind } });

    let category = args.categoryName
      ? categories.find((c) => c.name.toLowerCase() === args.categoryName!.toLowerCase()) ??
        categories.find((c) => c.name.toLowerCase().includes(args.categoryName!.toLowerCase()))
      : undefined;

    // No explicit category given — see if a previously-learned keyword hint matches the note.
    if (!category && args.note) {
      const hints = await prisma.categoryHint.findMany({ include: { category: true } });
      const noteLower = args.note.toLowerCase();
      const hint = hints.find((h) => noteLower.includes(h.keyword.toLowerCase()));
      if (hint && !hint.category.archived && hint.category.kind === kind) category = hint.category;
    }

    if (!category) {
      return {
        needsCategory: true,
        availableCategories: categories.map((c) => c.name),
        instruction:
          "No confident category match for this. Ask the user which category to use, then call log_transaction again with categoryName set to their answer (and learnKeyword set to a short distinguishing word from the note, so it's remembered next time).",
      };
    }
    categoryId = category.id;

    if (args.learnKeyword) {
      await prisma.categoryHint.upsert({
        where: { keyword: args.learnKeyword.toLowerCase() },
        update: { categoryId: category.id },
        create: { keyword: args.learnKeyword.toLowerCase(), categoryId: category.id },
      });
    }
  }

  const date = args.date ? new Date(args.date) : new Date();

  const tx = await prisma.transaction.create({
    data: {
      date,
      entryType: args.entryType,
      amount: args.amount,
      person: args.person ?? "SHARED",
      particulars: args.note ?? null,
      accountId: account.id,
      categoryId,
    },
    include: { category: true, account: true },
  });

  const activity = await recordActivity({
    entity: "TRANSACTION",
    action: "CREATE",
    entityId: tx.id,
    summary: `Bes AI logged ${formatMoney(toNumber(tx.amount))} ${tx.entryType.toLowerCase().replace("_", " ")}`,
    after: transactionSnapshot(tx),
  });

  return {
    success: true,
    logged: {
      date: dayjs(tx.date).format("YYYY-MM-DD"),
      entryType: tx.entryType,
      amount: toNumber(tx.amount),
      account: tx.account.name,
      category: tx.category?.name ?? null,
      person: tx.person,
      note: tx.particulars,
    },
    activityId: activity.id,
    undoHint: "This was logged via Settings > Recent Actions and can be undone there if it's wrong.",
  };
}

async function resolveAccount(name?: string) {
  const accounts = await prisma.account.findMany({ where: { archived: false } });
  return (
    accounts.find((a) => a.name.toLowerCase() === (name ?? "").toLowerCase()) ??
    accounts.find((a) => a.name.toLowerCase().includes((name ?? "").toLowerCase())) ??
    undefined
  );
}

async function resolveCategory(name: string, kind: "EXPENSE" | "SAVINGS") {
  const categories = await prisma.category.findMany({ where: { archived: false, kind } });
  return (
    categories.find((c) => c.name.toLowerCase() === name.toLowerCase()) ??
    categories.find((c) => c.name.toLowerCase().includes(name.toLowerCase())) ??
    undefined
  );
}

function summarizeTx(tx: {
  id: string;
  date: Date;
  entryType: string;
  amount: unknown;
  person: string;
  particulars: string | null;
  account: { name: string };
  category: { name: string } | null;
}) {
  return {
    id: tx.id,
    date: dayjs(tx.date).format("YYYY-MM-DD"),
    entryType: tx.entryType,
    amount: toNumber(tx.amount),
    account: tx.account.name,
    category: tx.category?.name ?? null,
    person: tx.person,
    note: tx.particulars,
  };
}

async function toolFindTransactions(args: {
  period?: Period;
  keyword?: string;
  person?: string;
  limit?: number;
}) {
  const { start, end } = periodRange(args.period ?? "all");
  const where: Record<string, unknown> = { date: { gte: start, lte: end } };
  if (args.person && args.person !== "ALL") where.person = args.person;
  if (args.keyword) {
    where.OR = [
      { particulars: { contains: args.keyword, mode: "insensitive" } },
      { category: { name: { contains: args.keyword, mode: "insensitive" } } },
    ];
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true, account: true },
    orderBy: { date: "desc" },
    take: args.limit ?? 10,
  });

  return { transactions: transactions.map(summarizeTx) };
}

async function toolUpdateTransaction(args: {
  id: string;
  amount?: number;
  entryType?: "EXPENSE" | "INCOME" | "SAVINGS_DEPOSIT" | "SAVINGS_WITHDRAW";
  accountName?: string;
  categoryName?: string;
  person?: "JENNA" | "KENNETH" | "SHARED";
  note?: string;
  date?: string;
}) {
  const existing = await prisma.transaction.findUnique({
    where: { id: args.id },
    include: { account: true, category: true },
  });
  if (!existing) return { error: "Transaction not found. Use find_transactions first." };

  const data: Record<string, unknown> = {};
  if (args.amount !== undefined) {
    if (args.amount <= 0) return { error: "Amount must be a positive number." };
    data.amount = args.amount;
  }
  if (args.entryType) data.entryType = args.entryType;
  if (args.note !== undefined) data.particulars = args.note;
  if (args.date) data.date = new Date(args.date);
  if (args.accountName) {
    const account = await resolveAccount(args.accountName);
    if (!account) return { error: `No account found matching "${args.accountName}".` };
    data.accountId = account.id;
  }
  if (args.categoryName) {
    const kind = (args.entryType ?? existing.entryType) === "EXPENSE" ? "EXPENSE" : "SAVINGS";
    const category = await resolveCategory(args.categoryName, kind);
    if (!category) return { error: `No category found matching "${args.categoryName}".` };
    data.categoryId = category.id;
  }

  const before = transactionSnapshot(existing);

  const updated = await prisma.transaction.update({
    where: { id: args.id },
    data,
    include: { account: true, category: true },
  });

  const activity = await recordActivity({
    entity: "TRANSACTION",
    action: "UPDATE",
    entityId: updated.id,
    summary: `Bes AI updated ${formatMoney(toNumber(updated.amount))} ${updated.entryType.toLowerCase().replace("_", " ")}`,
    before,
    after: transactionSnapshot(updated),
  });

  return { success: true, updated: summarizeTx(updated), activityId: activity.id };
}

async function toolDeleteTransaction(args: { id: string }) {
  const existing = await prisma.transaction.findUnique({
    where: { id: args.id },
    include: { account: true, category: true },
  });
  if (!existing) return { error: "Transaction not found. Use find_transactions first." };

  await prisma.transaction.delete({ where: { id: args.id } });

  const activity = await recordActivity({
    entity: "TRANSACTION",
    action: "DELETE",
    entityId: args.id,
    summary: `Bes AI deleted ${formatMoney(toNumber(existing.amount))} ${existing.entryType.toLowerCase().replace("_", " ")}`,
    before: transactionSnapshot(existing),
  });

  return { success: true, deleted: summarizeTx(existing), activityId: activity.id };
}

export async function executeTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "get_balances":
      return toolGetBalances();
    case "get_spending":
      return toolGetSpending(args as { period: Period; person?: string });
    case "get_budget_progress":
      return toolGetBudgetProgress();
    case "log_transaction":
      return toolLogTransaction(
        args as Parameters<typeof toolLogTransaction>[0]
      );
    case "find_transactions":
      return toolFindTransactions(
        args as Parameters<typeof toolFindTransactions>[0]
      );
    case "update_transaction":
      return toolUpdateTransaction(
        args as Parameters<typeof toolUpdateTransaction>[0]
      );
    case "delete_transaction":
      return toolDeleteTransaction(args as { id: string });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
