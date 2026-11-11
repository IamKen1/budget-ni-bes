import type { ReactNode } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import {
  getExpenseCategoriesWithProgress,
  getSavingsCategoriesWithProgress,
  getArchivedCategories,
  monthRange,
  cutoffRange,
} from "@/lib/queries";
import { ArchiveToggleButton } from "@/components/ArchiveToggleButton";
import { toggleArchiveCategory } from "@/lib/actions/categories";
import { AddCategoryForm } from "@/components/AddCategoryForm";
import { CategoryRow, type CategoryStatus } from "@/components/CategoryRow";
import { MaskableAmount } from "@/components/MaskableAmount";
import { expenseHint, periodProgress, rankExpenses, type RankedExpense } from "@/lib/category-status";

function SectionCard({ children }: { children: ReactNode }) {
  return (
    <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </ul>
  );
}

function GroupLabel({ children, divider }: { children: ReactNode; divider?: boolean }) {
  return (
    <li
      className={`px-4 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 ${
        divider ? "border-t border-zinc-100 dark:border-zinc-800" : ""
      }`}
    >
      {children}
    </li>
  );
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: viewParam } = await searchParams;
  const view = viewParam === "month" ? "month" : "cutoff";
  const period = view === "month" ? monthRange() : cutoffRange();
  const targetScope = view === "month" ? "month" : dayjs().date() <= 14 ? "first-half" : "second-half";
  const periodWord = view === "month" ? "this month" : "this cutoff";

  const [expenseCategories, savingsCategories, archivedCategories] = await Promise.all([
    getExpenseCategoriesWithProgress(period, targetScope),
    getSavingsCategoriesWithProgress(period),
    getArchivedCategories(),
  ]);

  const { pace, daysLeft } = periodProgress(period);
  const periodLabel = period.label.replace("-", "–");
  const { ranked: expenses, attention, onTrack } = rankExpenses(expenseCategories, pace);

  const overCount = expenses.filter((c) => c.status === "over").length;
  const warnCount = expenses.filter((c) => c.status === "warn").length;
  const totalLeft = expenses.reduce(
    (sum, c) => sum + (c.periodTarget > 0 ? Math.max(0, c.periodTarget - c.periodTotal) : 0),
    0
  );

  const totalSaved = savingsCategories.reduce((sum, c) => sum + c.allTimeTotal, 0);
  const totalGoal = savingsCategories.reduce((sum, c) => sum + c.goalTarget, 0);

  const renderExpense = (c: RankedExpense) => (
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
  );

  return (
    <div className="flex flex-col gap-5 pb-4 lg:mx-auto lg:max-w-lg lg:px-4 lg:pt-6">
      <header className="flex items-start justify-between gap-3 pt-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Categories</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {periodLabel} ·{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {daysLeft} {daysLeft === 1 ? "day" : "days"} left
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            {overCount > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-red-600 dark:bg-red-950 dark:text-red-400">
                {overCount} over
              </span>
            )}
            {warnCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                {warnCount} near limit
              </span>
            )}
            {overCount === 0 && warnCount === 0 && expenses.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                All on track
              </span>
            )}
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <MaskableAmount value={totalLeft} /> left total
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-900">
          {(["cutoff", "month"] as const).map((v) => (
            <Link
              key={v}
              href={`/categories?view=${v}`}
              className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition ${
                view === v
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {v === "cutoff" ? "Cutoff" : "Month"}
            </Link>
          ))}
        </div>
      </header>

      <section>
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Expenses</h2>
          <span className="text-xs font-medium text-zinc-400">{expenses.length} categories</span>
        </div>
        {expenses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-400 dark:border-zinc-700">
            No expense categories yet. Add one below.
          </p>
        ) : (
          <SectionCard>
            {attention.length > 0 && <GroupLabel>Needs attention</GroupLabel>}
            {attention.map(renderExpense)}
            {attention.length > 0 && onTrack.length > 0 && <GroupLabel divider>On track</GroupLabel>}
            {onTrack.map(renderExpense)}
          </SectionCard>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Savings Funds</h2>
          {totalGoal > 0 && (
            <span className="text-xs font-medium text-zinc-400">
              <MaskableAmount value={totalSaved} /> / <MaskableAmount value={totalGoal} />
            </span>
          )}
        </div>
        {savingsCategories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-400 dark:border-zinc-700">
            No savings funds yet.
          </p>
        ) : (
          <SectionCard>
            {savingsCategories.map((c) => {
              const hasGoal = c.goalTarget > 0;
              const value = hasGoal ? c.allTimeTotal : c.periodTotal;
              const target = hasGoal ? c.goalTarget : c.periodTarget;
              const status: CategoryStatus = target <= 0 ? "none" : value >= target ? "done" : "ok";
              return (
                <CategoryRow
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  kind="SAVINGS"
                  status={status}
                  value={value}
                  target={target}
                  note={
                    hasGoal
                      ? { amount: c.periodTotal, label: periodWord, warn: c.periodTarget > 0 && c.periodTotal <= 0 }
                      : undefined
                  }
                  archived={c.archived}
                  monthlyTarget={c.monthlyTarget}
                  goalTarget={c.goalTarget}
                />
              );
            })}
          </SectionCard>
        )}
      </section>

      <AddCategoryForm />

      {archivedCategories.length > 0 && (
        <details className="group rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Archived ({archivedCategories.length})
            <span className="text-xs transition group-open:rotate-180">▾</span>
          </summary>
          <ul className="border-t border-zinc-100 dark:border-zinc-800">
            {archivedCategories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-2.5 last:border-b-0 dark:border-zinc-800"
              >
                <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                  {c.name}
                  <span className="ml-1.5 text-[11px] text-zinc-400">
                    {c.kind === "SAVINGS" ? "Savings" : "Expense"}
                  </span>
                </span>
                <ArchiveToggleButton id={c.id} archived toggleAction={toggleArchiveCategory} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
