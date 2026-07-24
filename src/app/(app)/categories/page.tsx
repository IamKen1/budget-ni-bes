import {
  getExpenseCategoriesWithProgress,
  getSavingsCategoriesWithProgress,
} from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { ArchiveToggleButton } from "@/components/ArchiveToggleButton";
import { toggleArchiveCategory } from "@/lib/actions/categories";
import { AddCategoryForm } from "@/components/AddCategoryForm";
import { ProgressBar } from "@/components/ProgressBar";
import { EditCategoryTargets } from "@/components/EditCategoryTargets";

export default async function CategoriesPage() {
  const [expenseCategories, savingsCategories] = await Promise.all([
    getExpenseCategoriesWithProgress(),
    getSavingsCategoriesWithProgress(),
  ]);

  const totalSaved = savingsCategories.reduce((sum, c) => sum + c.allTimeTotal, 0);
  const totalGoal = savingsCategories.reduce((sum, c) => sum + c.goalTarget, 0);

  return (
    <div className="flex flex-col gap-5 pb-4">
      <header className="pt-2">
        <h1 className="text-xl font-semibold tracking-tight">Categories</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Monthly targets and long-term savings goals
        </p>
      </header>

      <section>
        <h2 className="px-1 pb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Expenses — This Month
        </h2>
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {expenseCategories.map((category) => (
            <div key={category.id} className={category.archived ? "opacity-50" : ""}>
              <ProgressBar
                label={category.name}
                value={category.periodTotal}
                target={category.monthlyTarget}
              />
              <div className="mt-2 flex items-center justify-between">
                <EditCategoryTargets
                  categoryId={category.id}
                  monthlyTarget={category.monthlyTarget}
                  goalTarget={category.goalTarget}
                  showGoal={false}
                />
                <ArchiveToggleButton
                  archived={category.archived}
                  onToggle={toggleArchiveCategory.bind(null, category.id, !category.archived)}
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
                label={`${category.name} · this month`}
                value={category.periodTotal}
                target={category.monthlyTarget}
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
                  archived={category.archived}
                  onToggle={toggleArchiveCategory.bind(null, category.id, !category.archived)}
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
