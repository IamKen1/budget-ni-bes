import Link from "next/link";
import dayjs from "dayjs";
import {
  getAccountsWithBalances,
  getExpenseCategoriesWithProgress,
  computeExtraMoney,
  SPENDING_ACCOUNT_NAMES,
  monthRange,
  cutoffRange,
} from "@/lib/queries";
import { formatMoney } from "@/lib/format";
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

  const [accounts, categories] = await Promise.all([
    getAccountsWithBalances(),
    getExpenseCategoriesWithProgress(period, targetScope),
  ]);

  const { spendingBalance, categoryRemaining, overBudgetCategories, extraMoney } = computeExtraMoney(
    accounts,
    categories
  );
  const spendingAccounts = accounts.filter((a) => SPENDING_ACCOUNT_NAMES.includes(a.name));
  const notOverCategories = categories.filter((c) => c.periodTarget > 0 && c.periodTotal <= c.periodTarget);

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
          {formatMoney(spendingBalance)} sa Maribank + Cash on Hand − {formatMoney(categoryRemaining)} pang budget na di pa nagagastos
        </p>
      </header>

      <section>
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Available Balance
          </h2>
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {formatMoney(spendingBalance)}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {spendingAccounts.map((a) => (
            <Link
              key={a.id}
              href={`/transactions?accountId=${a.id}`}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 transition active:bg-zinc-50 dark:active:bg-zinc-800"
            >
              <span className="text-sm font-medium">{a.name}</span>
              <span className="text-sm font-semibold">{formatMoney(a.balance)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Natitirang Budget (di pa over)
          </h2>
          <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            −{formatMoney(categoryRemaining)}
          </span>
        </div>
        <p className="px-1 pb-2 text-xs text-zinc-400">
          Kung mali yung amount na nagastos, i-tap yung category para makita at ma-edit ang mga transaction doon.
        </p>
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {notOverCategories.map((c) => (
            <Link key={c.id} href={`/transactions?categoryId=${c.id}`} className="block">
              <ProgressBar label={c.name} value={c.periodTotal} target={c.periodTarget} />
            </Link>
          ))}
          {notOverCategories.length === 0 && (
            <p className="text-sm text-zinc-400">Walang natitirang budget this period.</p>
          )}
        </div>
      </section>

      {overBudgetCategories.length > 0 && (
        <section>
          <h2 className="px-1 pb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            May Sobra Na (di na kasama sa computation)
          </h2>
          <p className="px-1 pb-2 text-xs text-zinc-400">
            Nasa balance na yung sobrang gastos dito, kaya hindi na ibinabawas ulit sa Extra Money.
          </p>
          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {overBudgetCategories.map((c) => (
              <Link key={c.id} href={`/transactions?categoryId=${c.id}`} className="block">
                <ProgressBar label={c.name} value={c.periodTotal} target={c.periodTarget} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
