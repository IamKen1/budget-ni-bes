import { getAllTransactions } from "@/lib/queries";
import { formatDateFull } from "@/lib/format";
import { DeletableTransactionRow } from "@/components/DeletableTransactionRow";
import { LoggedToast } from "@/components/LoggedToast";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ logged?: string }>;
}) {
  const [transactions, { logged }] = await Promise.all([getAllTransactions(), searchParams]);

  const groups = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const key = formatDateFull(tx.date);
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  return (
    <div className="flex flex-col gap-4 pb-4 lg:mx-auto lg:max-w-lg lg:px-4 lg:pt-6">
      {logged && <LoggedToast activityId={logged} />}
      <header className="pt-2">
        <h1 className="text-xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {transactions.length} total
        </p>
      </header>

      {transactions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
          No transactions yet. Tap the + button to add your first one.
        </div>
      )}

      {Array.from(groups.entries()).map(([date, txs]) => (
        <section key={date}>
          <h2 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {date}
          </h2>
          <div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {txs.map((tx) => (
              <DeletableTransactionRow key={tx.id} transaction={tx} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
