import Link from "next/link";
import dayjs from "dayjs";
import {
  getExpenseCategoriesWithProgress,
  getSavingsCategoriesWithProgress,
  monthRange,
  cutoffRange,
} from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { ArchiveToggleButton } from "@/components/ArchiveToggleButton";
import { toggleArchiveCategory } from "@/lib/actions/categories";
import { AddCategoryForm } from "@/components/AddCategoryForm";
import { ProgressBar } from "@/components/ProgressBar";
import { EditCategoryTargets } from "@/components/EditCategoryTargets";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: viewParam } = await searchParams;
  const view = viewParam === "month" ? "month" : "cutoff";
  const period = view === "month" ? monthRange() : cutoffRange();
  const targetScope = view === "month" ? "month" : dayjs().date() <= 14 ? "first-half" : "second-half";

  const [expenseCategories, savingsCategories] = await Promise.all([
    getExpenseCategoriesWithProgress(period, targetScope),
    getSavingsCategoriesWithProgress(period),
  ]);

  const totalSaved = savingsCategories.reduce((sum, c) => sum + c.allTimeTotal, 0);
  const totalGoal = savingsCategories.reduce((sum, c) => sum + c.goalTarget, 0);

  return (
    <div className="flex flex-col gap-5 pb-4 lg:mx-auto lg:max-w-lg lg:px-4 lg:pt-6">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Categories</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {view === "month" ? "Monthly" : "Cutoff"} targets and long-term savings goals
          </p>
        </div>
        <div className="flex gap-0.5 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-900">
          <Link
            href="/categories?view=cutoff"
            className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition ${
              view === "cutoff"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            Cutoff
          </Link>
          <Link
            href="/categories?view=month"
            className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition ${
              view === "month"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            Month
          </Link>
        </div>
      </header>

      <section>
        <h2 className="px-1 pb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Expenses — {view === "month" ? "This Month" : "This Cutoff"}
        </h2>
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {expenseCategories.map((category) => (
            <div key={category.id} className={category.archived ? "opacity-50" : ""}>
              <ProgressBar
                label={category.name}
                value={category.periodTotal}
                target={category.periodTarget}
              />
              <div className="mt-2 flex items-center justify-between">
                <EditCategoryTargets
                  categoryId={category.id}
                  monthlyTarget={category.monthlyTarget}
                  goalTarget={category.goalTarget}
                  firstHalfTarget={category.firstHalfTarget}
                  isCommittedSpend={category.isCommittedSpend}
                  showGoal={false}
                />
                <ArchiveToggleButton
                  id={category.id}
                  archived={category.archived}
                  toggleAction={toggleArchiveCategory}
                />
              </div>
            </div>
          ))}
          {expenseCategories.length === 0 && (
            <p className="text-sm text-zinc-400">No expense categories yet.</p>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Savings Funds
          </h2>
          {totalGoal > 0 && (
            <span className="text-xs font-medium text-zinc-400">
              {formatMoney(totalSaved)} / {formatMoney(totalGoal)} total goal
            </span>
          )}
        </div>
        <div className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {savingsCategories.map((category) => (
            <div key={category.id} className={category.archived ? "opacity-50" : ""}>
              <ProgressBar
                label={`${category.name} · ${view === "month" ? "this month" : "this cutoff"}`}
                value={category.periodTotal}
                target={category.periodTarget}
                tone="emerald"
              />
              {category.goalTarget > 0 && (
                <div className="mt-2.5">
                  <ProgressBar
                    label="Overall goal"
                    value={category.allTimeTotal}
                    target={category.goalTarget}
                    tone="emerald"
                  />
                </div>
              )}
              <div className="mt-2 flex items-center justify-between">
                <EditCategoryTargets
                  categoryId={category.id}
                  monthlyTarget={category.monthlyTarget}
                  goalTarget={category.goalTarget}
                  showGoal={true}
                />
                <ArchiveToggleButton
                  id={category.id}
                  archived={category.archived}
                  toggleAction={toggleArchiveCategory}
                />
              </div>
            </div>
          ))}
          {savingsCategories.length === 0 && (
            <p className="text-sm text-zinc-400">No savings funds yet.</p>
          )}
        </div>
      </section>

      <AddCategoryForm />
    </div>
  );
}
