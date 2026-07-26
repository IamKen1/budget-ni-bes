"use client";

import type { SerializedTransaction } from "@/lib/queries";
import { formatDate, formatMoney } from "@/lib/format";
import { entryTypeLabel } from "@/lib/labels";
import { useTransactionDetail } from "@/components/TransactionDetailContext";

const entryTone: Record<string, string> = {
  INCOME: "text-emerald-600 dark:text-emerald-400",
  SAVINGS_WITHDRAW: "text-emerald-600 dark:text-emerald-400",
  EXPENSE: "text-red-500 dark:text-red-400",
  SAVINGS_DEPOSIT: "text-amber-600 dark:text-amber-400",
  TRANSFER: "text-zinc-500 dark:text-zinc-400",
};

const entrySign: Record<string, string> = {
  INCOME: "+",
  SAVINGS_WITHDRAW: "+",
  EXPENSE: "-",
  SAVINGS_DEPOSIT: "-",
  TRANSFER: "",
};

export function TransactionRow({ transaction }: { transaction: SerializedTransaction }) {
  const { open } = useTransactionDetail();

  const title =
    transaction.particulars ||
    transaction.category?.name ||
    (transaction.entryType === "TRANSFER"
      ? `${transaction.account.name} → ${transaction.toAccount?.name ?? ""}`
      : entryTypeLabel[transaction.entryType]);

  const subtitle = [
    transaction.account.name,
    transaction.category?.name && transaction.category.name !== title
      ? transaction.category.name
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={() => open(transaction)}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-left transition active:bg-zinc-50 dark:active:bg-zinc-800/50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-zinc-400">
          {formatDate(transaction.date)}
          {subtitle ? ` · ${subtitle}` : ""}
        </p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className={`text-sm font-semibold ${entryTone[transaction.entryType]}`}>
          {entrySign[transaction.entryType]}
          {formatMoney(transaction.amount)}
        </p>
        {transaction.runningBalance !== undefined && (
          <p className="text-[11px] text-zinc-400">
            Bal: {formatMoney(transaction.runningBalance)}
          </p>
        )}
      </div>
    </button>
  );
}
