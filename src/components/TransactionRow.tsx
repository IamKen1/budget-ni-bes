"use client";

import type { SerializedTransaction } from "@/lib/queries";
import { formatDate, formatMoney } from "@/lib/format";
import { entryTypeLabel } from "@/lib/labels";
import { useTransactionDetail } from "@/components/TransactionDetailContext";
import { useBalanceVisibility } from "@/components/BalanceVisibilityContext";

const entryTone: Record<string, string> = {
  INCOME: "text-emerald-600 dark:text-emerald-400",
  SAVINGS_DEPOSIT: "text-emerald-600 dark:text-emerald-400",
  EXPENSE: "text-red-500 dark:text-red-400",
  SAVINGS_WITHDRAW: "text-amber-600 dark:text-amber-400",
  TRANSFER: "text-zinc-500 dark:text-zinc-400",
};

const entrySign: Record<string, string> = {
  INCOME: "+",
  SAVINGS_DEPOSIT: "+",
  EXPENSE: "-",
  SAVINGS_WITHDRAW: "-",
  TRANSFER: "",
};

export function TransactionRow({ transaction }: { transaction: SerializedTransaction }) {
  const { open } = useTransactionDetail();
  const { visible } = useBalanceVisibility();

  const isTransfer = transaction.entryType === "TRANSFER";

  // For transfers, which accounts moved money is the primary fact — always show the
  // arrow as the title, never let a note silently hide which account got the other side.
  const title = isTransfer
    ? `${transaction.account.name} → ${transaction.toAccount?.name ?? ""}`
    : transaction.particulars || transaction.category?.name || entryTypeLabel[transaction.entryType];

  const subtitle = [
    isTransfer ? transaction.particulars : transaction.account.name,
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
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          <span className="truncate">{title}</span>
          {transaction.entryType === "SAVINGS_WITHDRAW" && (
            <span className="flex-shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              Savings Withdrawn
            </span>
          )}
        </p>
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
            Bal: {visible ? formatMoney(transaction.runningBalance) : "₱ • • •"}
          </p>
        )}
      </div>
    </button>
  );
}
