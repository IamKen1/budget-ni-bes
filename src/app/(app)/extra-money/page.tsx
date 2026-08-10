import Link from "next/link";
import dayjs from "dayjs";
import {
  getAllTransactions,
  getExpenseCategoriesWithProgress,
  monthRange,
  cutoffRange,
} from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { DeletableTransactionRow } from "@/components/DeletableTransactionRow";
import { ProgressBar } from "@/components/ProgressBar";

export default async function ExtraMoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: viewParam } = await searchParams;
  const view = viewParam === "month" ? "month" : "cutoff";
  const period = view === "month" ? monthRange() : cutoffRange();
  const targetScope = view === "month" ? "month" : dayjs().date() <= 14 ? "first-half" : "second-half";

  const [incomeTx, expenseTx, categories] = await Promise.all([
    getAllTransactions({ entryType: "INCOME", from: period.start, to: period.end }),
    getAllTransactions({ entryType: "EXPENSE", from: period.start, to: period.end }),
    getExpenseCategoriesWithProgress(period, targetScope),
  ]);

  const totalIncome = incomeTx.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenseTx.reduce((s, t) => s + t.amount, 0);
  const budgetedCategories = categories.filter((c) => c.periodTarget > 0 || c.periodTotal > 0);
  const totalCategoryRemaining = budgetedCategories.reduce((s, c) => s + (c.periodTarget - c.periodTotal), 0);
  const extraMoney = totalIncome - totalExpense - totalCategoryRemaining;

  return (
    <div className="flex flex-col gap-5 pb-4 lg:mx-auto lg:max-w-lg lg:px-4 lg:pt-6">
      <header className="pt-2">
        <Link href="/" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          Extra Money — {period.label}
        </h1>
        <p
          className={`mt-1 text-2xl font-semibold tracking-tight ${
            extraMoney < 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {formatMoney(extraMoney)}
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          {formatMoney(totalIncome)} pumasok − {formatMoney(totalExpense)} nagastos − {formatMoney(totalCategoryRemaining)} pang budget na di pa nagagastos
        </p>
      </header>

      <section>
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Pumasok — Income
          </h2>
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {formatMoney(totalIncome)}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {incomeTx.map((tx) => (
            <DeletableTransactionRow key={tx.id} transaction={tx} />
          ))}
          {incomeTx.length === 0 && (
            <p className="p-3 text-sm text-zinc-400">Walang income entries this period.</p>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Nagastos — Expenses
          </h2>
          <span className="text-sm font-semibold text-red-500 dark:text-red-400">
            {formatMoney(totalExpense)}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {expenseTx.map((tx) => (
            <DeletableTransactionRow key={tx.id} transaction={tx} />
          ))}
          {expenseTx.length === 0 && (
            <p className="p-3 text-sm text-zinc-400">Walang expense entries this period.</p>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Natitirang Budget per Category
          </h2>
          <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            {formatMoney(totalCategoryRemaining)}
          </span>
        </div>
        <p className="px-1 pb-2 text-xs text-zinc-400">
          Kung mali yung amount na nagastos, i-tap yung category para makita at ma-edit ang mga transaction doon.
        </p>
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {budgetedCategories.map((c) => (
            <Link key={c.id} href={`/transactions?categoryId=${c.id}`} className="block">
              <ProgressBar label={c.name} value={c.periodTotal} target={c.periodTarget} />
            </Link>
          ))}
          {budgetedCategories.length === 0 && (
            <p className="text-sm text-zinc-400">No budgeted categories this period.</p>
          )}
        </div>
      </section>
    </div>
  );
}
