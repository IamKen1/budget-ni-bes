import Link from "next/link";
import { getAllTransactions } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { formatDateFull } from "@/lib/format";
import { DeletableTransactionRow } from "@/components/DeletableTransactionRow";
import { LoggedToast } from "@/components/LoggedToast";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    logged?: string;
    accountId?: string;
    categoryId?: string;
    entryType?: string;
    from?: string;
    to?: string;
    label?: string;
  }>;
}) {
  const { logged, accountId, categoryId, entryType, from, to, label } = await searchParams;

  const [transactions, filterAccount, filterCategory] = await Promise.all([
    getAllTransactions({
      accountId,
      categoryId,
      entryType,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    }),
    accountId ? prisma.account.findUnique({ where: { id: accountId } }) : null,
    categoryId ? prisma.category.findUnique({ where: { id: categoryId } }) : null,
  ]);

  const groups = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const key = formatDateFull(tx.date);
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const filterLabel = label ?? filterAccount?.name ?? filterCategory?.name ?? null;

  return (
    <div className="flex flex-col gap-4 pb-4 lg:mx-auto lg:max-w-lg lg:px-4 lg:pt-6">
      {logged && <LoggedToast activityId={logged} />}
      <header className="pt-2">
        <h1 className="text-xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {transactions.length} total
        </p>
      </header>

      {filterLabel && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/30">
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            Filtered: {filterLabel}
          </span>
          <Link href="/transactions" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Clear
          </Link>
        </div>
      )}

      {transactions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
          {filterLabel ? "No transactions for this filter." : "No transactions yet. Tap the + button to add your first one."}
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
