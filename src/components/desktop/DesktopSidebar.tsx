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

export function DesktopSidebar({
  view,
  cutoff,
  periodLabel,
  totalBalance,
  income,
  expense,
  saved,
  accounts,
  expenseCategories,
  savingsCategories,
  upcomingLoanGroup,
}: {
  view: "cutoff" | "month";
  cutoff: string;
  periodLabel: string;
  totalBalance: number;
  income: number;
  expense: number;
  saved: number;
  accounts: (SerializedAccount & { balance: number })[];
  expenseCategories: CategoryProgress[];
  savingsCategories: CategoryProgress[];
  upcomingLoanGroup: LoanPaymentMonthGroup | null;
}) {
  const { filter, setFilter } = useDesktopFilter();
  const { visible } = useBalanceVisibility();
  const money = (n: number) => (visible ? formatMoney(n) : "₱ • • •");

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
        <div className="mt-1.5 flex gap-3 text-[10px]">
          <div>
            <p className="text-emerald-100">Income</p>
            <p className="font-semibold"><MaskableAmount value={income} /></p>
          </div>
          <div>
            <p className="text-emerald-100">Expenses</p>
            <p className="font-semibold"><MaskableAmount value={expense} /></p>
          </div>
          <div>
            <p className="text-emerald-100">Saved</p>
            <p className="font-semibold"><MaskableAmount value={saved} /></p>
          </div>
        </div>
      </div>

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
                  <EditAccountTarget accountId={a.id} monthlyTarget={a.monthlyTarget} />
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

      <section className="mt-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Budget {view === "month" ? "This Month" : "This Cutoff"}
        </h2>
        <div className="mt-1.5 flex flex-col gap-2.5">
          {expenseCategories.slice(0, 4).map((c) => {
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
          {expenseCategories.length === 0 && (
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
    </aside>
  );
}
