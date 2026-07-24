import type { SerializedTransaction } from "@/lib/queries";
import { formatDate, formatMoney } from "@/lib/format";
import { entryTypeLabel } from "@/lib/labels";

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
    <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 active:bg-zinc-50 dark:active:bg-zinc-800/50">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-zinc-400">
          {formatDate(transaction.date)}
          {subtitle ? ` · ${subtitle}` : ""}
        </p>
      </div>
      <p className={`flex-shrink-0 text-sm font-semibold ${entryTone[transaction.entryType]}`}>
        {entrySign[transaction.entryType]}
        {formatMoney(transaction.amount)}
      </p>
    </div>
  );
}
