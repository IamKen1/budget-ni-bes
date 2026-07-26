import type { SerializedTransaction } from "@/lib/queries";
import { formatDateFull } from "@/lib/format";
import { DeletableTransactionRow } from "@/components/DeletableTransactionRow";

export function DesktopTransactionPanel({
  transactions,
}: {
  transactions: SerializedTransaction[];
}) {
  const groups = new Map<string, SerializedTransaction[]>();
  for (const tx of transactions) {
    const key = formatDateFull(tx.date);
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2.5">
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
        {transactions.length === 0 && (
          <p className="p-4 text-center text-xs text-zinc-400">
            No transactions yet. Use the form above to add one.
          </p>
        )}
      </div>
    </div>
  );
}
