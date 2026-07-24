import Link from "next/link";
import {
  getAccountsWithBalances,
  getExpenseCategoriesWithProgress,
  getSavingsCategoriesWithProgress,
  getPeriodSummary,
  getPersonSpendBreakdown,
  getRecentTransactions,
  monthRange,
  currentCutoffLabel,
} from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { accountTypeLabel, personLabel } from "@/lib/labels";
import { logout } from "@/lib/actions/session";
import { TransactionRow } from "@/components/TransactionRow";
import { ProgressBar } from "@/components/ProgressBar";

export default async function DashboardPage() {
  const period = monthRange();
  const [accounts, expenseCategories, savingsCategories, summary, personSpend, recent] =
    await Promise.all([
      getAccountsWithBalances(),
      getExpenseCategoriesWithProgress(period),
      getSavingsCategoriesWithProgress(period),
      getPeriodSummary(period),
      getPersonSpendBreakdown(period),
      getRecentTransactions(8),
    ]);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalExpenseTarget = expenseCategories.reduce((sum, c) => sum + c.monthlyTarget, 0);
  const expenseVariance = totalExpenseTarget - summary.expense;
  const cutoff = currentCutoffLabel();
  const totalPersonSpend = personSpend.JENNA + personSpend.KENNETH + personSpend.SHARED;

  return (
    <div className="flex flex-col gap-6 pb-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Hi, Bes 👋 · {cutoff} cutoff
          </p>
          <h1 className="text-xl font-semibold tracking-tight">{period.label} Budget</h1>
        </div>
        <form action={logout}>
          <button
            type="submit"
            aria-label="Log out"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 dark:bg-zinc-900 dark:text-zinc-400"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3M16 17l5-5-5-5M21 12H9"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
      </header>

      <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-white shadow-lg shadow-emerald-600/20">
        <p className="text-sm font-medium text-emerald-100">Total Balance</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">
          {formatMoney(totalBalance)}
        </p>
        <div className="mt-5 flex gap-4 text-sm">
          <div>
            <p className="text-emerald-100">Income</p>
            <p className="font-semibold">{formatMoney(summary.income)}</p>
          </div>
          <div>
            <p className="text-emerald-100">Expenses</p>
            <p className="font-semibold">{formatMoney(summary.expense)}</p>
          </div>
          <div>
            <p className="text-emerald-100">Saved</p>
            <p className="font-semibold">{formatMoney(summary.saved)}</p>
          </div>
        </div>
        {totalExpenseTarget > 0 && (
          <p className="mt-4 text-xs font-medium text-emerald-100">
            {expenseVariance >= 0
              ? `${formatMoney(expenseVariance)} left of your ${formatMoney(totalExpenseTarget)} monthly budget`
              : `${formatMoney(Math.abs(expenseVariance))} over your ${formatMoney(totalExpenseTarget)} monthly budget`}
          </p>
        )}
      </div>

      {accounts
        .filter((a) => a.monthlyTarget > 0)
        .map((account) => (
          <div
            key={account.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <ProgressBar
              label={`${account.name} — spending money`}
              value={account.balance}
              target={account.monthlyTarget}
            />
          </div>
        ))}

      <section>
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Accounts</h2>
          <Link href="/accounts" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Manage
          </Link>
        </div>
        <div className="no-scrollbar mt-2 flex gap-3 overflow-x-auto px-1 pb-1">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="min-w-[9.5rem] flex-shrink-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="text-xs font-medium text-zinc-400">{accountTypeLabel[account.type]}</p>
              <p className="mt-1 truncate text-sm font-semibold">{account.name}</p>
              <p className="mt-2 text-base font-semibold">{formatMoney(account.balance)}</p>
            </div>
          ))}
        </div>
      </section>

      {totalPersonSpend > 0 && (
        <section>
          <h2 className="px-1 pb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Spending by Person
          </h2>
          <div className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {(["JENNA", "KENNETH", "SHARED"] as const).map((p) => (
              <div key={p} className="flex-1">
                <p className="text-xs font-medium text-zinc-400">{personLabel[p]}</p>
                <p className="mt-1 text-sm font-semibold">{formatMoney(personSpend[p])}</p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                    style={{
                      width: `${totalPersonSpend > 0 ? Math.round((personSpend[p] / totalPersonSpend) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Budget This Month</h2>
          <Link href="/categories" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            View all
          </Link>
        </div>
        <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {expenseCategories.slice(0, 5).map((category) => (
            <ProgressBar
              key={category.id}
              label={category.name}
              value={category.periodTotal}
              target={category.monthlyTarget}
            />
          ))}
          {expenseCategories.length === 0 && (
            <p className="text-sm text-zinc-400">No expense categories yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="px-1 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Savings Goals
        </h2>
        <div className="mt-2 flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {savingsCategories.slice(0, 4).map((category) => (
            <ProgressBar
              key={category.id}
              label={category.name}
              value={category.allTimeTotal}
              target={category.goalTarget}
              tone="emerald"
              showVariance={false}
            />
          ))}
          {savingsCategories.length === 0 && (
            <p className="text-sm text-zinc-400">No savings funds yet.</p>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Recent Activity</h2>
          <Link href="/transactions" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            See all
          </Link>
        </div>
        <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {recent.map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} />
          ))}
          {recent.length === 0 && (
            <p className="p-3 text-sm text-zinc-400">No transactions yet. Tap + to add one.</p>
          )}
        </div>
      </section>
    </div>
  );
}
