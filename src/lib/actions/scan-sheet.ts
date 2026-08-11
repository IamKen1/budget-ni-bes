"use server";

import ExcelJS from "exceljs";
import dayjs from "dayjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/actions/activity";
import { transactionSnapshot } from "@/lib/activity-snapshots";

type EntryType = "INCOME" | "EXPENSE" | "SAVINGS_DEPOSIT" | "SAVINGS_WITHDRAW";

type ParsedRow = {
  date: Date;
  accountName: string;
  entryType: EntryType;
  categoryName: string | null;
  amount: number;
  note: string | null;
  isSalaryIncome: boolean;
  rowNumber: number;
  /// "Monthly Budget / Withdraw" or "Monthly Budget / Deposit" rows (categoryless,
  /// non-salary) represent cash physically moving between the family's own
  /// Maribank/Cash on Hand accounts — the sheet logs each leg separately, but the
  /// app may have already recorded the same real-world movement as one TRANSFER
  /// transaction instead. Flagged so the matcher checks TRANSFER history before
  /// reporting these as missing (a lesson from a real duplicate-logging incident —
  /// see the isInternalTransfer branch below).
  isInternalTransfer: boolean;
};

export type ScanRow = {
  row?: number;
  id?: string;
  date: string;
  account: string;
  entryType: string;
  category: string | null;
  amount: number;
  note: string | null;
  isSalaryIncome: boolean;
};

export type ScanResult = {
  error?: string;
  totalRows?: number;
  matched?: number;
  missingFromApp?: ScanRow[];
  extraInApp?: ScanRow[];
  /// Internal-transfer-shaped rows (Monthly Budget Withdraw/Deposit) that don't
  /// exactly match an INCOME/EXPENSE in the app, but a TRANSFER transaction
  /// exists on the same account/day — most likely already covered under a
  /// different amount grouping. Never offered a one-tap "Log this": logging
  /// these blind risks double-counting a transfer that's already there.
  possibleTransfers?: ScanRow[];
};

// The sheet uses these short account labels consistently — mapped explicitly
// rather than fuzzy-matched, since "BPI" alone would otherwise ambiguously
// match both "BPI Joint" and "BPI – Credit Card Payment".
const SOURCE_TO_ACCOUNT: Record<string, string> = {
  maribank: "Maribank",
  bpi: "BPI Joint",
  coh: "Cash on Hand",
};

function cellText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") {
    if ("richText" in (value as Record<string, unknown>)) {
      const rt = (value as { richText: { text: string }[] }).richText;
      return rt.map((p) => p.text).join("");
    }
    if ("result" in (value as Record<string, unknown>)) {
      return cellText((value as { result: unknown }).result);
    }
    if (value instanceof Date) return null;
  }
  return String(value);
}

function cellNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object" && value !== null && "result" in (value as Record<string, unknown>)) {
    return cellNumber((value as { result: unknown }).result);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapRow(row: ExcelJS.Row, rowNumber: number): ParsedRow | null {
  const dateValue = row.getCell(3).value;
  const source = cellText(row.getCell(4).value);
  const entry = cellText(row.getCell(5).value);
  const type = cellText(row.getCell(6).value);
  const amount = cellNumber(row.getCell(7).value);
  const note = cellText(row.getCell(8).value);

  if (!(dateValue instanceof Date) || isNaN(dateValue.getTime())) return null;
  if (amount === null || amount <= 0) return null;

  const accountName = SOURCE_TO_ACCOUNT[(source ?? "").trim().toLowerCase()];
  if (!accountName) return null;

  const entryKey = (entry ?? "").trim().toLowerCase();
  const typeStr = (type ?? "").trim();

  let entryType: EntryType;
  let categoryName: string | null = null;
  let isSalaryIncome = false;
  let isInternalTransfer = false;

  if (entryKey === "expense") {
    entryType = "EXPENSE";
    categoryName = typeStr || null;
  } else if (entryKey === "savings") {
    entryType = "SAVINGS_DEPOSIT";
    categoryName = typeStr || null;
  } else if (entryKey === "withdraw savings") {
    entryType = "SAVINGS_WITHDRAW";
    categoryName = typeStr || null;
  } else if (entryKey === "monthly budget") {
    if (/salary/i.test(typeStr)) {
      entryType = "INCOME";
      isSalaryIncome = true;
    } else if (/deposit/i.test(typeStr)) {
      entryType = "INCOME";
      isInternalTransfer = true;
    } else if (/withdraw/i.test(typeStr)) {
      entryType = "EXPENSE";
      isInternalTransfer = true;
    } else if (typeStr) {
      // A category name in the Type column (e.g. "Motor/Car Gas/Diesel") — a
      // real category expense, not a plain withdraw/deposit. Previously
      // silently dropped here, which hid genuine rows from every scan.
      entryType = "EXPENSE";
      categoryName = typeStr;
    } else {
      return null;
    }
  } else {
    return null;
  }

  return { date: dateValue, accountName, entryType, categoryName, amount, note, isSalaryIncome, rowNumber, isInternalTransfer };
}

export async function scanSheet(formData: FormData): Promise<ScanResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file uploaded." };

  let workbook: ExcelJS.Workbook;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    return { error: "Couldn't read that file — make sure it's a valid .xlsx." };
  }

  const sheet = workbook.getWorksheet("Family Savings and Expenses");
  if (!sheet) return { error: `No "Family Savings and Expenses" sheet found in that file.` };

  const parsedRows: ParsedRow[] = [];
  for (let r = 3; r <= sheet.rowCount; r++) {
    const parsed = mapRow(sheet.getRow(r), r);
    if (parsed) parsedRows.push(parsed);
  }

  if (parsedRows.length === 0) {
    return { error: "No recognizable rows found — check this is the right sheet/format." };
  }

  const minDate = new Date(Math.min(...parsedRows.map((r) => r.date.getTime())));
  const maxDate = new Date(Math.max(...parsedRows.map((r) => r.date.getTime())));
  const rangeStart = dayjs(minDate).subtract(1, "day").toDate();
  const rangeEnd = dayjs(maxDate).add(1, "day").toDate();

  const [accounts, categories, dbTx] = await Promise.all([
    prisma.account.findMany(),
    prisma.category.findMany(),
    prisma.transaction.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd } },
      include: { account: true, category: true },
    }),
  ]);

  const accountByName = new Map(accounts.map((a) => [a.name, a]));
  const claimed = new Set<string>();
  const missingFromApp: ScanRow[] = [];
  const possibleTransfers: ScanRow[] = [];

  for (const row of parsedRows) {
    const account = accountByName.get(row.accountName);
    if (!account) continue;

    const dayStart = dayjs(row.date).startOf("day").toDate();
    const dayEnd = dayjs(row.date).endOf("day").toDate();

    const match = dbTx.find(
      (t) =>
        !claimed.has(t.id) &&
        t.accountId === account.id &&
        t.entryType === row.entryType &&
        Math.abs(Number(t.amount) - row.amount) < 0.01 &&
        t.date >= dayStart &&
        t.date <= dayEnd
    );

    if (match) {
      claimed.add(match.id);
      continue;
    }

    const scanRow: ScanRow = {
      row: row.rowNumber,
      date: dayjs(row.date).format("YYYY-MM-DD"),
      account: row.accountName,
      entryType: row.entryType,
      category: row.categoryName,
      amount: row.amount,
      note: row.note,
      isSalaryIncome: row.isSalaryIncome,
    };

    // Internal-transfer-shaped row with no exact INCOME/EXPENSE match — before
    // calling it missing, check whether a TRANSFER already covers this account
    // on this day. The sheet logs each leg of a Maribank<->Cash on Hand move
    // separately (and doesn't always group amounts the same way the app's own
    // TRANSFER entries do), so an exact amount match isn't required here —
    // just evidence the movement was already recorded some other way. This
    // exists because an earlier reconciliation pass logged brand-new
    // INCOME/EXPENSE pairs for rows exactly like this without checking for an
    // existing TRANSFER first, silently double-counting real money.
    if (row.isInternalTransfer) {
      const relatedTransfer = dbTx.find(
        (t) =>
          t.entryType === "TRANSFER" &&
          (t.accountId === account.id || t.toAccountId === account.id) &&
          t.date >= dayStart &&
          t.date <= dayEnd
      );
      if (relatedTransfer) {
        possibleTransfers.push(scanRow);
        continue;
      }
    }

    missingFromApp.push(scanRow);
  }

  const extraInApp: ScanRow[] = dbTx
    .filter((t) => !claimed.has(t.id))
    .map((t) => ({
      id: t.id,
      date: dayjs(t.date).format("YYYY-MM-DD"),
      account: t.account.name,
      entryType: t.entryType,
      category: t.category?.name ?? null,
      amount: Number(t.amount),
      note: t.particulars,
      isSalaryIncome: t.isSalaryIncome,
    }));

  return {
    totalRows: parsedRows.length,
    matched: parsedRows.length - missingFromApp.length - possibleTransfers.length,
    missingFromApp,
    extraInApp,
    possibleTransfers,
  };
}

/** Logs a single "missing from app" row the user tapped "Log this" on. Requires an
 * exact account-name match (the scan only ever produces the app's own real account
 * names) and resolves the category by name/kind, same fuzzy rule used elsewhere. */
export async function logScannedRow(row: ScanRow): Promise<{ success?: true; activityId?: string; error?: string }> {
  const account = await prisma.account.findUnique({ where: { name: row.account } });
  if (!account) return { error: `Account "${row.account}" not found.` };

  let categoryId: string | null = null;
  if (row.category && (row.entryType === "EXPENSE" || row.entryType === "SAVINGS_DEPOSIT" || row.entryType === "SAVINGS_WITHDRAW")) {
    const kind = row.entryType === "EXPENSE" ? "EXPENSE" : "SAVINGS";
    const categories = await prisma.category.findMany({ where: { kind } });
    const category =
      categories.find((c) => c.name.toLowerCase() === row.category!.toLowerCase()) ??
      categories.find((c) => c.name.toLowerCase().includes(row.category!.toLowerCase()));
    if (!category) return { error: `No ${kind.toLowerCase()} category found matching "${row.category}".` };
    categoryId = category.id;
  }

  const tx = await prisma.transaction.create({
    data: {
      date: new Date(row.date),
      entryType: row.entryType as EntryType,
      amount: row.amount,
      person: "SHARED",
      particulars: row.note,
      accountId: account.id,
      categoryId,
      isSalaryIncome: row.entryType === "INCOME" ? row.isSalaryIncome : false,
    },
    include: { category: true, account: true },
  });

  const activity = await recordActivity({
    entity: "TRANSACTION",
    action: "CREATE",
    entityId: tx.id,
    summary: `Logged ${tx.amount} ${tx.entryType.toLowerCase().replace("_", " ")} from Scan Sheet`,
    after: transactionSnapshot(tx),
  });

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/categories");

  return { success: true, activityId: activity.id };
}
