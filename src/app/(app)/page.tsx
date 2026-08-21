import Link from "next/link";
import dayjs from "dayjs";
import {
  getAccountsWithBalances,
  getExpenseCategoriesWithProgress,
  getSavingsCategoriesWithProgress,
  getPersonSpendBreakdown,
  getRecentTransactions,
  getAllTransactions,
  getLoanPaymentsByMonth,
  getSpendingAccountsCashFlow,
  getSavingsCategoryBalance,
  monthRange,
  cutoffRange,
  currentCutoffLabel,
} from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { accountTypeLabel, personLabel } from "@/lib/labels";
import { logout } from "@/lib/actions/session";
import { TransactionRow } from "@/components/TransactionRow";
import { ProgressBar } from "@/components/ProgressBar";
import { CategoryBudgetCard } from "@/components/CategoryBudgetCard";
import { MaskableAmount } from "@/components/MaskableAmount";
import { BalanceVisibilityToggle } from "@/components/BalanceVisibilityToggle";
import { SpecialDayBanner } from "@/components/SpecialDayBanner";
import { RefreshButton } from "@/components/RefreshButton";
import { DesktopDashboard } from "@/components/desktop/DesktopDashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  // Defaults to the current semi-monthly cutoff (1-15 / 16-end) rather than
  // the full calendar month, since that's the period salary actually lands
  // in and the family budgets against — a "Month" toggle is available for
  // whoever wants the full-month totals instead. Each expense category has
  // its own per-cutoff target (firstHalfTarget / monthlyTarget - firstHalfTarget)
  // since the split isn't always even (e.g. "Jen CC" is 8000/4000) — periodTarget
  // below always reflects whichever one matches the active view.
  const { view: viewParam } = await searchParams;
  const view = viewParam === "month" ? "month" : "cutoff";
  const period = view === "month" ? monthRange() : cutoffRange();
  const targetScope = view === "month" ? "month" : dayjs().date() <= 14 ? "first-half" : "second-half";
  const [
    accounts,
    expenseCategories,
    savingsCategories,
    personSpend,
    recent,
    allTransactions,
    loanGroups,
    spendingCashFlow,
    daddyBalance,
  ] = await Promise.all([
    getAccountsWithBalances(),
    getExpenseCategoriesWithProgress(period, targetScope),
    getSavingsCategoriesWithProgress(period),
    getPersonSpendBreakdown(period),
    getRecentTransactions(8),
    getAllTransactions(),
    getLoanPaymentsByMonth(),
    getSpendingAccountsCashFlow(period),
    getSavingsCategoryBalance("Daddy"),
  ]);

  const upcomingLoanGroup = loanGroups.find((g) => !g.payments.every((p) => p.paid)) ?? loanGroups[0];
  const upcomingLoanCount = upcomingLoanGroup?.payments.filter((p) => !p.paid).length ?? 0;

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const cutoff = currentCutoffLabel();
  const totalPersonSpend = personSpend.JENNA + personSpend.KENNETH + personSpend.SHARED;

  // "Extra money" — verified directly against the family's own spreadsheet
  // (Summary Per Cutoff: REMAINING + TOTAL EXPENSE VARIANCE + Daddy ipon).
  // Cash flow is scoped to the spending-money accounts only (Maribank + Cash
  // on Hand — see getSpendingAccountsCashFlow), matching their sheet's "1-15
  // CUTOFF" tab which never touches BPI. Daddy's ipon sits outside the normal
  // category flow and is added back in on top. No loans involved here; loan
  // schedules live in a separate sheet the family doesn't cross-reference for
  // this particular figure.
  const totalCategoryRemaining = expenseCategories.reduce((s, c) => s + (c.periodTarget - c.periodTotal), 0);
  const extraMoney = spendingCashFlow.income - spendingCashFlow.expense - totalCategoryRemaining + daddyBalance;

  return (
    <>
    <div className="hidden lg:block">
      <DesktopDashboard
        view={view}
        cutoff={cutoff}
        periodLabel={period.label}
        totalBalance={totalBalance}
        extraMoney={extraMoney}
        spendingIncome={spendingCashFlow.income}
        spendingExpense={spendingCashFlow.expense}
        totalCategoryRemaining={totalCategoryRemaining}
        daddyBalance={daddyBalance}
        personSpend={personSpend}
        totalPersonSpend={totalPersonSpend}
        accounts={accounts}
        expenseCategories={expenseCategories}
        savingsCategories={savingsCategories}
        transactions={allTransactions}
        upcomingLoanGroup={upcomingLoanGroup ?? null}
      />
    </div>
    <div className="flex flex-col gap-6 pb-4 lg:hidden">
      <header className="flex items-center justify-between gap-2 pt-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{period.label} Budget</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <RefreshButton />
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 dark:bg-zinc-900 dark:text-zinc-400"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.8} />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <form action={logout}>
            <button
              type="submit"
              aria-label="Log out"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 dark:bg-zinc-900 dark:text-zinc-400"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
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
        </div>
      </header>

      <SpecialDayBanner />

      <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-4 text-white shadow-lg shadow-emerald-600/20">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-emerald-100">Total Balance</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 rounded-full bg-white/15 p-0.5">
              <Link
                href="/?view=cutoff"
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  view === "cutoff" ? "bg-white text-emerald-700" : "text-emerald-100"
                }`}
              >
                Cutoff
              </Link>
              <Link
                href="/?view=month"
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  view === "month" ? "bg-white text-emerald-700" : "text-emerald-100"
                }`}
              >
                Month
              </Link>
            </div>
            <BalanceVisibilityToggle />
          </div>
        </div>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight">
          <MaskableAmount value={totalBalance} />
        </p>

        <Link
          href={`/extra-money?view=${view}`}
          className="mt-4 block rounded-2xl bg-white/10 p-3 transition active:scale-[0.98]"
        >
          <p className="text-xs font-medium text-emerald-100">
            Extra Money — {view === "month" ? "This Month" : "This Cutoff"}
          </p>
          <p
            className={`mt-0.5 text-xl font-semibold tracking-tight ${
              extraMoney < 0 ? "text-red-200" : "text-white"
            }`}
          >
            <MaskableAmount value={extraMoney} />
          </p>
          <p className="mt-1 text-[11px] text-emerald-100/80 underline decoration-emerald-100/30 underline-offset-2">
            <MaskableAmount value={spendingCashFlow.income} /> pumasok, <MaskableAmount value={spendingCashFlow.expense} /> nagastos,{" "}
            <MaskableAmount value={totalCategoryRemaining} /> pang budget na di pa nagagastos, +<MaskableAmount value={daddyBalance} /> ipon ni Daddy — tap to see the list
          </p>
        </Link>
      </div>

      {accounts
        .filter((a) => a.monthlyTarget > 0)
        .map((account) => (
          <Link
            key={account.id}
            href={`/transactions?accountId=${account.id}`}
            className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
          >
            <ProgressBar
              label={`${account.name} — spending money`}
              value={account.balance}
              target={account.monthlyTarget}
              leftValue={account.balance}
            />
          </Link>
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
            <Link
              key={account.id}
              href={`/transactions?accountId=${account.id}`}
              className="min-w-[9.5rem] flex-shrink-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="text-xs font-medium text-zinc-400">{accountTypeLabel[account.type]}</p>
              <p className="mt-1 truncate text-sm font-semibold">{account.name}</p>
              <p className="mt-2 text-base font-semibold">
                <MaskableAmount value={account.balance} />
              </p>
            </Link>
          ))}
        </div>
      </section>

      {upcomingLoanGroup && (
        <section>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Upcoming Payments</h2>
            <Link href="/loans" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              View all
            </Link>
          </div>
          <Link
            href="/loans"
            className="mt-2 block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{upcomingLoanGroup.label}</p>
              <p className="text-sm font-semibold"><MaskableAmount value={upcomingLoanGroup.total} /></p>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              {upcomingLoanCount > 0
                ? `${upcomingLoanCount} payment${upcomingLoanCount === 1 ? "" : "s"} due`
                : "All payments logged for this month"}
            </p>
          </Link>
        </section>
      )}

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
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Budget {view === "month" ? "This Month" : "This Cutoff"}
          </h2>
          <Link href="/categories" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            View all
          </Link>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {expenseCategories
            .filter((c) => c.periodTarget > 0)
            .map((category) => (
              <CategoryBudgetCard
                key={category.id}
                id={category.id}
                name={category.name}
                value={category.periodTotal}
                target={category.periodTarget}
              />
            ))}
          {expenseCategories.filter((c) => c.periodTarget > 0).length === 0 && (
            <p className="col-span-2 text-sm text-zinc-400">No expense categories yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="px-1 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Savings Goals
        </h2>
        <div className="mt-2 flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {savingsCategories.slice(0, 4).map((category) => (
            <Link key={category.id} href={`/transactions?categoryId=${category.id}`} className="block">
              <ProgressBar
                label={category.name}
                value={category.allTimeTotal}
                target={category.goalTarget}
                tone="emerald"
                showVariance={false}
              />
            </Link>
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
    </>
  );
}
