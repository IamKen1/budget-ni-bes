import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import {
  getAccountsWithBalances,
  getExpenseCategoriesWithProgress,
  monthRange,
} from "@/lib/queries";
import { recordActivity, clearAllTransactions } from "@/lib/actions/activity";
import { transactionSnapshot, accountSnapshot, categorySnapshot } from "@/lib/activity-snapshots";

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
      name: "get_savings_progress",
      description:
        "Get every savings fund (Emergency Fund, Car Fund, Home Fund, Baby Fund, etc.) with its long-term goal target and current net balance. Use this — not get_balances — for any question about a specific fund's amount, e.g. 'magkano na yung emergency fund', 'how much is in Baby Fund'. Fund balances are NOT the same as account balances. Also already includes a projection (averageMonthlyNetSaved, estimatedMonthsToReachGoal, estimatedDateToReachGoal) based on the fund's actual saving pace since its first deposit — use those fields directly to answer 'when will we have enough for X' questions instead of trying to compute it yourself from other tools.",
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
  {
    type: "function",
    function: {
      name: "manage_account",
      description:
        "Create a new account, change an account's monthly deposit target, or archive/restore one — the same things the Accounts page lets a human do. Use this when the user asks you to do it (e.g. 'gawa ka ng bagong account na GCash', 'baguhin mo yung target ng Maribank to 60000') rather than just explaining how. Always confirm before archive, and before create/set_target if any detail was assumed rather than stated.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "set_target", "archive", "unarchive"] },
          name: {
            type: "string",
            description: "Account name. For create, the new account's name. For other actions, the existing account to act on (fuzzy-matched).",
          },
          type: {
            type: "string",
            enum: ["BANK", "CASH", "EWALLET"],
            description: "Required for create.",
          },
          monthlyTarget: { type: "number", description: "Required for set_target." },
        },
        required: ["action", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_category",
      description:
        "Create a new expense/savings category, change its monthly (or savings goal) target, or archive/restore one — the same things the Categories page lets a human do. Use this when the user asks you to do it (e.g. 'gawa ka ng category na Pet Expenses', 'itaas mo yung Grocery budget to 8000') rather than just explaining how. Always confirm before archive, and before create/set_target if any detail was assumed rather than stated.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "set_target", "archive", "unarchive"] },
          name: {
            type: "string",
            description: "Category name. For create, the new category's name. For other actions, the existing category to act on (fuzzy-matched).",
          },
          kind: {
            type: "string",
            enum: ["EXPENSE", "SAVINGS"],
            description: "Required for create.",
          },
          monthlyTarget: { type: "number", description: "Monthly budget target. For set_target on an EXPENSE category, or the monthly contribution target on a SAVINGS fund." },
          goalTarget: { type: "number", description: "Long-term savings goal amount. Only meaningful for SAVINGS categories." },
        },
        required: ["action", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_between_accounts",
      description:
        "Move general spending money directly from one account to another, e.g. 'mag-transfer ka ng 2000 galing BPI papunta Maribank'. This is for moving already-general money between accounts — NOT for savings funds. If the money is going into or out of a savings fund (Emergency Fund, Car Fund, etc.), use log_transaction with SAVINGS_DEPOSIT/SAVINGS_WITHDRAW instead, per the withdrawing-from-savings rules.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Peso amount, positive number." },
          fromAccountName: { type: "string", description: "Account the money is moving out of, e.g. 'BPI'." },
          toAccountName: { type: "string", description: "Account the money is moving into, e.g. 'Maribank'." },
          person: {
            type: "string",
            enum: ["JENNA", "KENNETH", "SHARED"],
            description: "Who this transfer is for. Default SHARED if unclear.",
          },
          note: { type: "string", description: "Optional short note." },
          date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today if omitted." },
        },
        required: ["amount", "fromAccountName", "toAccountName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reset_all_transactions",
      description:
        "DESTRUCTIVE — deletes every transaction so every account and fund balance resets to zero (accounts, categories, and their targets are kept as-is). Same action as Settings > Danger Zone > Clear all transactions, gated by the same app passcode. Optionally logs one starting INCOME transaction right after clearing, so an account begins at a chosen balance instead of zero. Never call this unless: (1) you've plainly stated what will happen — everything deleted, every balance to zero, then the new starting amount if one was given — and the user replied yes to that in their next message, AND (2) the user has given you the app passcode in this conversation for this request. Never guess, reuse, or ask for the passcode before the user has already agreed to proceed.",
      parameters: {
        type: "object",
        properties: {
          passcode: {
            type: "string",
            description: "The app passcode, given by the user in this conversation after they've confirmed they want to proceed.",
          },
          startingAccountName: {
            type: "string",
            description: "Optional: account to log a starting balance into right after clearing, e.g. 'BPI'.",
          },
          startingAmount: {
            type: "number",
            description: "Optional: peso amount to log as the starting balance for startingAccountName.",
          },
        },
        required: ["passcode"],
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

async function toolGetSavingsProgress() {
  const categories = await prisma.category.findMany({
    where: { kind: "SAVINGS", archived: false },
    include: {
      transactions: { where: { entryType: { in: ["SAVINGS_DEPOSIT", "SAVINGS_WITHDRAW"] } } },
    },
  });

  const now = dayjs();

  return categories.map((c) => {
    const goalTarget = toNumber(c.goalTarget);
    let currentBalance = 0;
    let firstDate: Date | null = null;
    for (const tx of c.transactions) {
      const amount = toNumber(tx.amount);
      currentBalance += tx.entryType === "SAVINGS_WITHDRAW" ? -amount : amount;
      if (!firstDate || tx.date < firstDate) firstDate = tx.date;
    }

    const remainingToGoal = goalTarget > 0 ? goalTarget - currentBalance : null;
    // Projection: net saved per month since the first deposit, used to estimate
    // when the goal will be reached — precomputed here rather than asking the
    // model to chain tool calls and do the math itself, which is unreliable.
    let averageMonthlyNet: number | null = null;
    let estimatedMonthsToGoal: number | null = null;
    if (firstDate) {
      const monthsActive = Math.max(1, now.diff(firstDate, "month", true));
      averageMonthlyNet = currentBalance / monthsActive;
      if (remainingToGoal !== null && remainingToGoal > 0 && averageMonthlyNet > 0) {
        estimatedMonthsToGoal = Math.ceil(remainingToGoal / averageMonthlyNet);
      }
    }

    return {
      fund: c.name,
      goalTarget,
      currentBalance,
      remainingToGoal,
      percentOfGoal: goalTarget > 0 ? Math.round((currentBalance / goalTarget) * 100) : null,
      averageMonthlyNetSaved: averageMonthlyNet !== null ? Math.round(averageMonthlyNet) : null,
      estimatedMonthsToReachGoal: estimatedMonthsToGoal,
      estimatedDateToReachGoal:
        estimatedMonthsToGoal !== null
          ? now.add(estimatedMonthsToGoal, "month").format("MMMM YYYY")
          : null,
    };
  });
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

async function toolManageAccount(args: {
  action: "create" | "set_target" | "archive" | "unarchive";
  name: string;
  type?: "BANK" | "CASH" | "EWALLET";
  monthlyTarget?: number;
}) {
  if (args.action === "create") {
    if (!args.type) return { error: "Need an account type (BANK, CASH, or EWALLET) to create an account." };
    const existing = await resolveAccount(args.name);
    if (existing) return { error: `An account matching "${args.name}" already exists: "${existing.name}".` };

    const count = await prisma.account.count();
    const account = await prisma.account.create({ data: { name: args.name, type: args.type, sortOrder: count } });
    const activity = await recordActivity({
      entity: "ACCOUNT",
      action: "CREATE",
      entityId: account.id,
      summary: `Bes AI added account "${account.name}"`,
      after: accountSnapshot(account),
    });
    return { success: true, account: account.name, activityId: activity.id };
  }

  const account = await resolveAccount(args.name);
  if (!account) return { error: `No account found matching "${args.name}". Use get_balances to see the real list.` };

  if (args.action === "set_target") {
    if (args.monthlyTarget === undefined) return { error: "Need a monthlyTarget amount." };
    const before = accountSnapshot(account);
    const updated = await prisma.account.update({ where: { id: account.id }, data: { monthlyTarget: args.monthlyTarget } });
    const activity = await recordActivity({
      entity: "ACCOUNT",
      action: "UPDATE",
      entityId: account.id,
      summary: `Bes AI updated "${updated.name}" target to ${formatMoney(args.monthlyTarget)}`,
      before,
      after: accountSnapshot(updated),
    });
    return { success: true, account: updated.name, monthlyTarget: args.monthlyTarget, activityId: activity.id };
  }

  const archived = args.action === "archive";
  const before = accountSnapshot(account);
  const updated = await prisma.account.update({ where: { id: account.id }, data: { archived } });
  const activity = await recordActivity({
    entity: "ACCOUNT",
    action: "UPDATE",
    entityId: account.id,
    summary: archived ? `Bes AI archived account "${updated.name}"` : `Bes AI restored account "${updated.name}"`,
    before,
    after: accountSnapshot(updated),
  });
  return { success: true, account: updated.name, archived, activityId: activity.id };
}

async function toolManageCategory(args: {
  action: "create" | "set_target" | "archive" | "unarchive";
  name: string;
  kind?: "EXPENSE" | "SAVINGS";
  monthlyTarget?: number;
  goalTarget?: number;
}) {
  if (args.action === "create") {
    if (!args.kind) return { error: "Need a kind (EXPENSE or SAVINGS) to create a category." };
    const existing = await resolveCategory(args.name, args.kind);
    if (existing) return { error: `A ${args.kind.toLowerCase()} category matching "${args.name}" already exists: "${existing.name}".` };

    const count = await prisma.category.count({ where: { kind: args.kind } });
    const category = await prisma.category.create({
      data: {
        name: args.name,
        kind: args.kind,
        monthlyTarget: args.monthlyTarget ?? 0,
        goalTarget: args.goalTarget ?? 0,
        sortOrder: count,
      },
    });
    const activity = await recordActivity({
      entity: "CATEGORY",
      action: "CREATE",
      entityId: category.id,
      summary: `Bes AI added category "${category.name}"`,
      after: categorySnapshot(category),
    });
    return { success: true, category: category.name, activityId: activity.id };
  }

  const categories = await prisma.category.findMany({ where: { archived: false } });
  const category =
    categories.find((c) => c.name.toLowerCase() === args.name.toLowerCase()) ??
    categories.find((c) => c.name.toLowerCase().includes(args.name.toLowerCase()));
  if (!category) return { error: `No category found matching "${args.name}". Use get_budget_progress or get_savings_progress to see the real list.` };

  if (args.action === "set_target") {
    if (args.monthlyTarget === undefined && args.goalTarget === undefined) {
      return { error: "Need a monthlyTarget and/or goalTarget amount." };
    }
    const before = categorySnapshot(category);
    const updated = await prisma.category.update({
      where: { id: category.id },
      data: {
        monthlyTarget: args.monthlyTarget ?? toNumber(category.monthlyTarget),
        goalTarget: args.goalTarget ?? toNumber(category.goalTarget),
      },
    });
    const activity = await recordActivity({
      entity: "CATEGORY",
      action: "UPDATE",
      entityId: category.id,
      summary: `Bes AI updated "${updated.name}" target`,
      before,
      after: categorySnapshot(updated),
    });
    return { success: true, category: updated.name, activityId: activity.id };
  }

  const archived = args.action === "archive";
  const before = categorySnapshot(category);
  const updated = await prisma.category.update({ where: { id: category.id }, data: { archived } });
  const activity = await recordActivity({
    entity: "CATEGORY",
    action: "UPDATE",
    entityId: category.id,
    summary: archived ? `Bes AI archived category "${updated.name}"` : `Bes AI restored category "${updated.name}"`,
    before,
    after: categorySnapshot(updated),
  });
  return { success: true, category: updated.name, archived, activityId: activity.id };
}

async function toolTransferBetweenAccounts(args: {
  amount: number;
  fromAccountName: string;
  toAccountName: string;
  person?: "JENNA" | "KENNETH" | "SHARED";
  note?: string;
  date?: string;
}) {
  if (!args.amount || args.amount <= 0) {
    return { error: "Amount must be a positive number." };
  }

  const from = await resolveAccount(args.fromAccountName);
  if (!from) return { error: `No account found matching "${args.fromAccountName}".` };

  const to = await resolveAccount(args.toAccountName);
  if (!to) return { error: `No account found matching "${args.toAccountName}".` };

  if (from.id === to.id) {
    return { error: "fromAccountName and toAccountName resolved to the same account." };
  }

  const date = args.date ? new Date(args.date) : new Date();

  const tx = await prisma.transaction.create({
    data: {
      date,
      entryType: "TRANSFER",
      amount: args.amount,
      person: args.person ?? "SHARED",
      particulars: args.note ?? null,
      accountId: from.id,
      toAccountId: to.id,
    },
    include: { account: true, toAccount: true },
  });

  const activity = await recordActivity({
    entity: "TRANSACTION",
    action: "CREATE",
    entityId: tx.id,
    summary: `Bes AI transferred ${formatMoney(toNumber(tx.amount))} from ${from.name} to ${to.name}`,
    after: transactionSnapshot(tx),
  });

  return {
    success: true,
    transferred: {
      date: dayjs(tx.date).format("YYYY-MM-DD"),
      amount: toNumber(tx.amount),
      from: from.name,
      to: to.name,
      person: tx.person,
      note: tx.particulars,
    },
    activityId: activity.id,
    undoHint: "This was logged via Settings > Recent Actions and can be undone there if it's wrong.",
  };
}

async function toolResetAllTransactions(args: {
  passcode: string;
  startingAccountName?: string;
  startingAmount?: number;
}) {
  const result = await clearAllTransactions(args.passcode, "DELETE");
  if (result.error) return { error: result.error };

  let startingBalanceLogged = null;
  if (args.startingAccountName && args.startingAmount) {
    startingBalanceLogged = await toolLogTransaction({
      entryType: "INCOME",
      amount: args.startingAmount,
      accountName: args.startingAccountName,
      person: "SHARED",
      note: "Starting balance",
    });
  }

  return { success: true, cleared: true, startingBalanceLogged };
}

export async function executeTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "get_balances":
      return toolGetBalances();
    case "get_spending":
      return toolGetSpending(args as { period: Period; person?: string });
    case "get_budget_progress":
      return toolGetBudgetProgress();
    case "get_savings_progress":
      return toolGetSavingsProgress();
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
    case "manage_account":
      return toolManageAccount(args as Parameters<typeof toolManageAccount>[0]);
    case "manage_category":
      return toolManageCategory(args as Parameters<typeof toolManageCategory>[0]);
    case "transfer_between_accounts":
      return toolTransferBetweenAccounts(args as Parameters<typeof toolTransferBetweenAccounts>[0]);
    case "reset_all_transactions":
      return toolResetAllTransactions(args as Parameters<typeof toolResetAllTransactions>[0]);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
