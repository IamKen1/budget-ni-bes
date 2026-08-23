"use client";

import Link from "next/link";
import type {
  SerializedAccount,
  CategoryProgress,
  LoanPaymentMonthGroup,
} from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { accountTypeLabel } from "@/lib/labels";
import { logout } from "@/lib/actions/session";
import { ProgressBar } from "@/components/ProgressBar";
import { MaskableAmount } from "@/components/MaskableAmount";
import { BalanceVisibilityToggle } from "@/components/BalanceVisibilityToggle";
import { useBalanceVisibility } from "@/components/BalanceVisibilityContext";
import { ArchiveToggleButton } from "@/components/ArchiveToggleButton";
import { EditAccountTarget } from "@/components/EditAccountTarget";
import { EditCategoryTargets } from "@/components/EditCategoryTargets";
import { AddAccountForm } from "@/components/AddAccountForm";
import { AddCategoryForm } from "@/components/AddCategoryForm";
import { toggleArchiveAccount } from "@/lib/actions/accounts";
import { toggleArchiveCategory } from "@/lib/actions/categories";
import { useDesktopFilter } from "@/components/desktop/DesktopFilterContext";
import { personLabel } from "@/lib/labels";
import type { Person } from "@/generated/prisma/client";

export function DesktopSidebar({
  view,
  cutoff,
  periodLabel,
  totalBalance,
  extraMoney,
  spendingBalance,
  totalCategoryRemaining,
  personSpend,
  totalPersonSpend,
  accounts,
  expenseCategories,
  savingsCategories,
  upcomingLoanGroup,
}: {
  view: "cutoff" | "month";
  cutoff: string;
  periodLabel: string;
  totalBalance: number;
  extraMoney: number;
  spendingBalance: number;
  totalCategoryRemaining: number;
  personSpend: Record<Person, number>;
  totalPersonSpend: number;
  accounts: (SerializedAccount & { balance: number })[];
  expenseCategories: CategoryProgress[];
  savingsCategories: CategoryProgress[];
  upcomingLoanGroup: LoanPaymentMonthGroup | null;
}) {
  const { filter, setFilter } = useDesktopFilter();
  const { visible } = useBalanceVisibility();
  const money = (n: number) => (visible ? formatMoney(n) : "₱ • • •");
  const budgetedCategories = expenseCategories.filter((c) => c.periodTarget > 0);

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-zinc-400">Hi, Bes 👋 · {cutoff} cutoff</p>
          <h1 className="text-sm font-semibold tracking-tight">{periodLabel} Budget</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-900">
            <Link
              href="/?view=cutoff"
              className={`rounded-full px-2 py-1 text-[10px] font-medium transition ${
                view === "cutoff"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              Cutoff
            </Link>
            <Link
              href="/?view=month"
              className={`rounded-full px-2 py-1 text-[10px] font-medium transition ${
                view === "month"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              Month
            </Link>
          </div>
          <Link
            href="/reports"
            aria-label="Reports"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 dark:bg-zinc-900 dark:text-zinc-400"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
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
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 dark:bg-zinc-900 dark:text-zinc-400"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
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
              className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 dark:bg-zinc-900 dark:text-zinc-400"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
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
      </div>

      <div className="mt-3 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 px-3 py-2.5 text-white">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-emerald-100">Total Balance</p>
          <BalanceVisibilityToggle className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-90" />
        </div>
        <p className="text-lg font-semibold tracking-tight">
          <MaskableAmount value={totalBalance} />
        </p>
        <Link
          href={`/extra-money?view=${view}`}
          className="mt-2 block rounded-lg bg-white/10 p-2 transition active:scale-[0.98]"
        >
          <p className="text-[10px] font-medium text-emerald-100">
            Extra Money — {view === "month" ? "This Month" : "This Cutoff"}
          </p>
          <p className={`text-sm font-semibold ${extraMoney < 0 ? "text-red-200" : "text-white"}`}>
            <MaskableAmount value={extraMoney} />
          </p>
          <p className="mt-0.5 text-[9px] leading-snug text-emerald-100/80 underline decoration-emerald-100/30 underline-offset-2">
            <MaskableAmount value={spendingBalance} /> sa Maribank + COH,{" "}
            <MaskableAmount value={totalCategoryRemaining} /> pang budget
          </p>
        </Link>
      </div>

      {accounts.filter((a) => a.monthlyTarget > 0).length > 0 && (
        <section className="mt-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Spending Money
          </h2>
          <div className="mt-1.5 flex flex-col gap-2.5">
            {accounts
              .filter((a) => a.monthlyTarget > 0)
              .map((a) => (
                <Link key={a.id} href={`/transactions?accountId=${a.id}`} className="block">
                  <ProgressBar
                    label={`${a.name} — spending money`}
                    value={a.balance}
                    target={a.monthlyTarget}
                    leftValue={a.balance}
                  />
                </Link>
              ))}
          </div>
        </section>
      )}

      <section className="mt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Accounts
          </h2>
        </div>
        <div className="mt-1.5 flex flex-col gap-0.5">
          {accounts.map((a) => {
            const active = filter?.type === "account" && filter.id === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() =>
                  setFilter(active ? null : { type: "account", id: a.id, label: a.name })
                }
                className={`flex items-center justify-between rounded-lg px-1.5 py-1 text-xs transition ${
                  active
                    ? "bg-emerald-50 dark:bg-emerald-950/40"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <span
                  className={`truncate ${
                    active ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  {a.name}
                </span>
                <span className="flex-shrink-0 font-medium">{money(a.balance)}</span>
              </button>
            );
          })}
          {accounts.length === 0 && <p className="text-xs text-zinc-400">No accounts yet.</p>}
        </div>
        <details className="mt-1.5 text-xs">
          <summary className="cursor-pointer select-none text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Manage accounts
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-lg border border-zinc-100 p-2 dark:border-zinc-900">
                <p className="truncate text-[11px] font-medium">
                  {a.name} <span className="text-zinc-400">· {accountTypeLabel[a.type]}</span>
                </p>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <EditAccountTarget accountId={a.id} monthlyTarget={a.monthlyTarget} openingBalance={a.openingBalance} />
                  <ArchiveToggleButton id={a.id} archived={a.archived} toggleAction={toggleArchiveAccount} />
                </div>
              </div>
            ))}
            <AddAccountForm />
          </div>
        </details>
      </section>

      {upcomingLoanGroup && (
        <section className="mt-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Upcoming Payments
            </h2>
            <Link href="/loans" className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              View all
            </Link>
          </div>
          <Link
            href="/loans"
            className="mt-1.5 flex items-center justify-between rounded-lg px-1.5 py-1 text-xs transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <span className="text-zinc-600 dark:text-zinc-300">{upcomingLoanGroup.label}</span>
            <span className="font-medium">{money(upcomingLoanGroup.total)}</span>
          </Link>
        </section>
      )}

      {totalPersonSpend > 0 && (
        <section className="mt-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Spending by Person
          </h2>
          <div className="mt-1.5 flex gap-3">
            {(["JENNA", "KENNETH", "SHARED"] as const).map((p) => (
              <div key={p} className="flex-1">
                <p className="text-[10px] font-medium text-zinc-400">{personLabel[p]}</p>
                <p className="mt-0.5 text-xs font-semibold">{money(personSpend[p])}</p>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
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

      <section className="mt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Budget {view === "month" ? "This Month" : "This Cutoff"}
          </h2>
          {budgetedCategories.length > 4 && (
            <Link href="/categories" className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              See more
            </Link>
          )}
        </div>
        <div className="mt-1.5 flex flex-col gap-2.5">
          {budgetedCategories.slice(0, 4).map((c) => {
            const active = filter?.type === "category" && filter.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  setFilter(active ? null : { type: "category", id: c.id, label: c.name })
                }
                className={`rounded-lg p-1 text-left transition ${
                  active ? "bg-emerald-50 dark:bg-emerald-950/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <ProgressBar label={c.name} value={c.periodTotal} target={c.periodTarget} />
              </button>
            );
          })}
          {budgetedCategories.length === 0 && (
            <p className="text-xs text-zinc-400">No expense categories yet.</p>
          )}
        </div>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer select-none text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Manage categories
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {[...expenseCategories, ...savingsCategories].map((c) => (
              <div key={c.id} className="rounded-lg border border-zinc-100 p-2 dark:border-zinc-900">
                <p className="truncate text-[11px] font-medium">{c.name}</p>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <EditCategoryTargets
                    categoryId={c.id}
                    monthlyTarget={c.monthlyTarget}
                    goalTarget={c.goalTarget}
                    firstHalfTarget={savingsCategories.some((s) => s.id === c.id) ? undefined : c.firstHalfTarget}
                    isCommittedSpend={c.isCommittedSpend}
                    showGoal={savingsCategories.some((s) => s.id === c.id)}
                  />
                  <ArchiveToggleButton id={c.id} archived={c.archived} toggleAction={toggleArchiveCategory} />
                </div>
              </div>
            ))}
            <AddCategoryForm />
          </div>
        </details>
      </section>

      {savingsCategories.length > 0 && (
        <section className="mt-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Savings Goals
            </h2>
            {savingsCategories.length > 4 && (
              <Link href="/categories" className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                See more
              </Link>
            )}
          </div>
          <div className="mt-1.5 flex flex-col gap-2.5">
            {savingsCategories.slice(0, 4).map((c) => (
              <Link key={c.id} href={`/transactions?categoryId=${c.id}`} className="block">
                <ProgressBar
                  label={c.name}
                  value={c.allTimeTotal}
                  target={c.goalTarget}
                  tone="emerald"
                  showVariance={false}
                />
              </Link>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
