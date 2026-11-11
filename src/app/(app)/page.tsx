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
  computeExtraMoney,
  monthRange,
  cutoffRange,
  currentCutoffLabel,
  SPENDING_ACCOUNT_NAMES,
  type SerializedTransaction,
} from "@/lib/queries";
import { accountTypeLabel, personLabel } from "@/lib/labels";
import { TransactionRow } from "@/components/TransactionRow";
import { ProgressBar } from "@/components/ProgressBar";
import { MaskableAmount } from "@/components/MaskableAmount";
import { BalanceVisibilityToggle } from "@/components/BalanceVisibilityToggle";
import { SpecialDayBanner } from "@/components/SpecialDayBanner";
import { RefreshButton } from "@/components/RefreshButton";
import { DesktopDashboard } from "@/components/desktop/DesktopDashboard";
import { CategoryRow } from "@/components/CategoryRow";
import { MarkPaidButton } from "@/components/MarkPaidButton";
import { expenseHint, periodProgress, rankExpenses } from "@/lib/category-status";

function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between px-1 pb-2">
      <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{title}</h2>
      {href && (
        <Link href={href} className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function dayHeading(date: Date): string {
  const d = dayjs(date).startOf("day");
  const today = dayjs().startOf("day");
  if (d.isSame(today)) return "Today";
  if (d.isSame(today.subtract(1, "day"))) return "Yesterday";
  return d.format("MMM D");
}

function groupByDay(transactions: SerializedTransaction[]) {
  const groups: { label: string; items: SerializedTransaction[] }[] = [];
  for (const tx of transactions) {
    const label = dayHeading(tx.date);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(tx);
    else groups.push({ label, items: [tx] });
  }
  return groups;
}

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
  const [accounts, expenseCategories, savingsCategories, personSpend, recent, allTransactions, loanGroups] =
    await Promise.all([
      getAccountsWithBalances(),
      getExpenseCategoriesWithProgress(period, targetScope),
      getSavingsCategoriesWithProgress(period),
      getPersonSpendBreakdown(period),
      getRecentTransactions(8),
      getAllTransactions(),
      getLoanPaymentsByMonth(),
    ]);

  const upcomingLoanGroup = loanGroups.find((g) => !g.payments.every((p) => p.paid)) ?? loanGroups[0];

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const cutoff = currentCutoffLabel();
  const totalPersonSpend = personSpend.JENNA + personSpend.KENNETH + personSpend.SHARED;

  // "Extra money" — real spendable cash right now: the actual current balance
  // of the spending-money accounts (Maribank + Cash on Hand) minus whatever's
  // still earmarked for categories that haven't gone over budget yet this
  // period. Categories already over budget are excluded from that
  // subtraction — their overspend already came straight out of the real
  // balance, so reserving for them again would double count it. See
  // computeExtraMoney in queries.ts. Verified against the family's own numbers.
  const { spendingBalance, categoryRemaining: totalCategoryRemaining, extraMoney } = computeExtraMoney(
    accounts,
    expenseCategories
  );

  // ---- mobile-only derived data ----
  const { pace, daysLeft } = periodProgress(period);
  const periodEnd = dayjs(period.end);
  const perDay = daysLeft > 0 && extraMoney > 0 ? extraMoney / daysLeft : 0;
  const spendingTarget = accounts
    .filter((a) => SPENDING_ACCOUNT_NAMES.includes(a.name))
    .reduce((s, a) => s + a.monthlyTarget, 0);
  const spendingPct = spendingTarget > 0 ? Math.min(100, Math.round((spendingBalance / spendingTarget) * 100)) : 0;

  const { attention, onTrack } = rankExpenses(expenseCategories, pace);
  const overCategories = attention.filter((c) => c.status === "over");
  const totalOver = overCategories.reduce((s, c) => s + (c.periodTotal - c.periodTarget), 0);
  const budgetPreview = [...attention, ...onTrack.filter((c) => c.status !== "none")].slice(0, 4);
  const budgetedCount = expenseCategories.filter((c) => c.periodTarget > 0).length;

  const today = dayjs().startOf("day");
  const unpaid = loanGroups.flatMap((g) => g.payments).filter((p) => !p.paid);
  // Due dates group literally ("1-15" includes the 15th — see literalCutoffHalf in queries.ts),
  // unlike spending periods, where day 15 already belongs to the second half.
  const dueWindowEnd =
    view === "cutoff" && dayjs().date() <= 14 ? dayjs().date(15).endOf("day") : dayjs().endOf("month");
  const dueThisPeriod = unpaid.filter((p) => !dayjs(p.dueDate).isAfter(dueWindowEnd));
  const nextPayment = dueThisPeriod.length === 0 ? unpaid[0] : undefined;

  const recentByDay = groupByDay(recent);

  return (
    <>
    <div className="hidden lg:block">
      <DesktopDashboard
        view={view}
        cutoff={cutoff}
        periodLabel={period.label}
        totalBalance={totalBalance}
        extraMoney={extraMoney}
        spendingBalance={spendingBalance}
        totalCategoryRemaining={totalCategoryRemaining}
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
          <h1 className="truncate text-lg font-semibold tracking-tight">{period.label.replace("-", "–")}</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {daysLeft} {daysLeft === 1 ? "day" : "days"} left
            </span>{" "}
            {view === "month" ? "this month" : "in this cutoff"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <RefreshButton />
          <Link
            href="/reports"
            aria-label="Reports"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 dark:bg-zinc-900 dark:text-zinc-400"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M4 19V5m0 14h16M8 19v-6m4 6V9m4 10v-4"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
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
        </div>
      </header>

      <SpecialDayBanner />

      {/* Hero: Extra Money is the number you act on; total balance is context. */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-4 text-white shadow-lg shadow-emerald-600/20">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-emerald-100">Extra Money · safe to spend</p>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex gap-0.5 rounded-full bg-white/15 p-0.5">
              {(["cutoff", "month"] as const).map((v) => (
                <Link
                  key={v}
                  href={`/?view=${v}`}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    view === v ? "bg-white text-emerald-700" : "text-emerald-100"
                  }`}
                >
                  {v === "cutoff" ? "Cutoff" : "Month"}
                </Link>
              ))}
            </div>
            <BalanceVisibilityToggle />
          </div>
        </div>
        <p className={`mt-0.5 text-3xl font-semibold tracking-tight ${extraMoney < 0 ? "text-red-200" : ""}`}>
          <MaskableAmount value={extraMoney} />
        </p>
        {perDay > 0 && (
          <p className="mt-2 inline-block rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
            ≈ <MaskableAmount value={perDay} /> / day until {periodEnd.format("MMM D")}
          </p>
        )}
        {extraMoney < 0 && (
          <p className="mt-2 inline-block rounded-full bg-red-500/30 px-2.5 py-1 text-xs font-semibold">
            Spending money won't cover the remaining budget
          </p>
        )}

        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2 text-[11px] text-emerald-100">
            <span>Spending money (Maribank + Cash)</span>
            <span>
              <span className="font-semibold text-white">
                <MaskableAmount value={spendingBalance} />
              </span>
              {spendingTarget > 0 && (
                <>
                  {" "}/ <MaskableAmount value={spendingTarget} />
                </>
              )}
            </span>
          </div>
          {spendingTarget > 0 && (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${spendingPct}%` }} />
            </div>
          )}
          <p className="mt-1 text-[11px] text-emerald-100/80">
            <MaskableAmount value={totalCategoryRemaining} /> still reserved for category budgets
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-white/20 pt-2.5 text-xs text-emerald-100">
          <span>
            Total balance{" "}
            <span className="font-semibold text-white">
              <MaskableAmount value={totalBalance} />
            </span>
          </span>
          <Link href={`/extra-money?view=${view}`} className="font-medium text-white">
            Breakdown ›
          </Link>
        </div>
      </div>

      <section>
        <SectionHeader title="Accounts" href="/accounts" linkLabel="Manage" />
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-1 pb-1">
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

      {(dueThisPeriod.length > 0 || overCategories.length > 0) && (
        <section>
          <SectionHeader title="Needs attention" href="/loans" linkLabel={dueThisPeriod.length > 0 ? "Payments ›" : undefined} />
          <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {dueThisPeriod.map((p) => {
              const due = dayjs(p.dueDate).startOf("day");
              const days = due.diff(today, "day");
              const overdue = days < 0;
              const soon = days <= 3;
              const when = overdue
                ? `Overdue · ${due.format("MMM D")}`
                : days === 0
                ? "Due today"
                : `Due ${due.format("MMM D")} · in ${days} ${days === 1 ? "day" : "days"}`;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-800"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm ${
                      overdue
                        ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                        : soon
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                    aria-hidden
                  >
                    ₱
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.payee}</p>
                    <p
                      className={`text-[11px] font-medium ${
                        overdue
                          ? "text-red-500"
                          : soon
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-zinc-400"
                      }`}
                    >
                      {when}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold">
                      <MaskableAmount value={p.amount} />
                    </span>
                    <MarkPaidButton id={p.id} />
                  </div>
                </li>
              );
            })}
            {overCategories.length > 0 && (
              <li>
                <Link
                  href="/categories"
                  className="flex items-center gap-3 px-4 py-3 transition active:bg-zinc-50 dark:active:bg-zinc-800/50"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-sm font-bold text-red-600 dark:bg-red-950 dark:text-red-400"
                    aria-hidden
                  >
                    !
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {overCategories.length} {overCategories.length === 1 ? "category" : "categories"} over budget
                    </p>
                    <p className="truncate text-[11px] font-medium text-red-500">
                      {overCategories.map((c) => c.name).join(", ")} · <MaskableAmount value={totalOver} /> over
                    </p>
                  </div>
                  <span className="text-zinc-300 dark:text-zinc-600">›</span>
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      <section>
        <SectionHeader
          title={`Budget ${view === "month" ? "This Month" : "This Cutoff"}`}
          href={`/categories?view=${view}`}
          linkLabel={budgetedCount > 0 ? `All (${expenseCategories.length}) ›` : undefined}
        />
        {budgetPreview.length > 0 ? (
          <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {budgetPreview.map((c) => (
              <CategoryRow
                key={c.id}
                id={c.id}
                name={c.name}
                kind="EXPENSE"
                status={c.status}
                value={c.periodTotal}
                target={c.periodTarget}
                pace={pace}
                hint={expenseHint(c)}
                archived={c.archived}
                monthlyTarget={c.monthlyTarget}
                goalTarget={c.goalTarget}
                firstHalfTarget={c.firstHalfTarget}
                isCommittedSpend={c.isCommittedSpend}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-400 dark:border-zinc-700">
            No categories with a target yet.
          </p>
        )}
      </section>

      {nextPayment && (
        <Link
          href="/loans"
          className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-zinc-400">Next payment</p>
            <p className="truncate text-sm font-medium">
              {nextPayment.payee} · {dayjs(nextPayment.dueDate).format("MMM D")}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold">
            <MaskableAmount value={nextPayment.amount} />
          </span>
        </Link>
      )}

      <section>
        <SectionHeader title="Recent Activity" href="/transactions" linkLabel="See all" />
        <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {recentByDay.map((group) => (
            <div key={group.label}>
              <p className="px-2 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {group.label}
              </p>
              {group.items.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} hideDate />
              ))}
            </div>
          ))}
          {recent.length === 0 && (
            <p className="p-3 text-sm text-zinc-400">No transactions yet. Tap + to add one.</p>
          )}
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {totalPersonSpend > 0 && (
          <details className="group border-b border-zinc-100 dark:border-zinc-800">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="shrink-0 whitespace-nowrap text-sm font-medium">Spending by Person</span>
              <span className="min-w-0 truncate text-right text-[11px] text-zinc-400">
                {(["JENNA", "KENNETH", "SHARED"] as const)
                  .map((p) => `${personLabel[p]} ${Math.round((personSpend[p] / totalPersonSpend) * 100)}%`)
                  .join(" · ")}{" "}
                <span className="inline-block transition group-open:rotate-180">▾</span>
              </span>
            </summary>
            <div className="flex gap-3 px-4 pb-4">
              {(["JENNA", "KENNETH", "SHARED"] as const).map((p) => (
                <div key={p} className="flex-1">
                  <p className="text-xs font-medium text-zinc-400">{personLabel[p]}</p>
                  <p className="mt-1 text-sm font-semibold">
                    <MaskableAmount value={personSpend[p]} />
                  </p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                      style={{ width: `${Math.round((personSpend[p] / totalPersonSpend) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-medium">Savings Goals</span>
            <span className="text-[11px] text-zinc-400">
              {savingsCategories.length > 0 ? `${savingsCategories.length} funds` : "None yet"}{" "}
              <span className="inline-block transition group-open:rotate-180">▾</span>
            </span>
          </summary>
          <div className="flex flex-col gap-4 px-4 pb-4">
            {savingsCategories.map((category) => (
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
            {savingsCategories.length === 0 && <p className="text-sm text-zinc-400">No savings funds yet.</p>}
          </div>
        </details>
      </div>
    </div>
    </>
  );
}
