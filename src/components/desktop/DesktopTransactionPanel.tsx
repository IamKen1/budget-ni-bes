"use client";

import type { SerializedTransaction } from "@/lib/queries";
import { formatDateFull } from "@/lib/format";
import { DeletableTransactionRow } from "@/components/DeletableTransactionRow";
import { useDesktopFilter } from "@/components/desktop/DesktopFilterContext";

export function DesktopTransactionPanel({
  transactions,
}: {
  transactions: SerializedTransaction[];
}) {
  const { filter, setFilter } = useDesktopFilter();

  const filtered = !filter
    ? transactions
    : transactions.filter((tx) =>
        filter.type === "account"
          ? tx.accountId === filter.id || tx.toAccountId === filter.id
          : tx.categoryId === filter.id
      );

  const groups = new Map<string, SerializedTransaction[]>();
  for (const tx of filtered) {
    const key = formatDateFull(tx.date);
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2.5">
      {filter && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs dark:bg-emerald-950/30">
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            Filtered: {filter.label}
          </span>
          <button
            type="button"
            onClick={() => setFilter(null)}
            className="font-semibold text-emerald-600 dark:text-emerald-400"
          >
            Clear
          </button>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {Array.from(groups.entries()).map(([date, txs]) => (
          <section key={date}>
            <h2 className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              {date}
            </h2>
            <div className="flex flex-col gap-0.5 rounded-xl border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900">
              {txs.map((tx) => (
                <DeletableTransactionRow key={tx.id} transaction={tx} />
              ))}
            </div>
          </section>
        ))}
        {filtered.length === 0 && (
          <p className="p-4 text-center text-xs text-zinc-400">
            {filter ? "No transactions for this filter." : "No transactions yet. Use the form above to add one."}
          </p>
        )}
      </div>
    </div>
  );
}
