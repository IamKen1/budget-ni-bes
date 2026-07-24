import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import {
  getAccountsWithBalances,
  getExpenseCategoriesWithProgress,
  monthRange,
} from "@/lib/queries";

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
        "Record a new transaction (expense, income, savings deposit/withdraw, or transfer) in the budget tracker.",
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
            description: "Category name for EXPENSE or SAVINGS entries, e.g. 'Grocery', 'Jen CC', 'Emergency Fund'. Omit for INCOME.",
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
  if (args.categoryName) {
    const kind = args.entryType === "EXPENSE" ? "EXPENSE" : "SAVINGS";
    const categories = await prisma.category.findMany({ where: { archived: false, kind } });
    const category =
      categories.find((c) => c.name.toLowerCase() === args.categoryName!.toLowerCase()) ??
      categories.find((c) => c.name.toLowerCase().includes(args.categoryName!.toLowerCase()));
    categoryId = category?.id ?? null;
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
  };
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
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
