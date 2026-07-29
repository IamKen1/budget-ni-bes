import { getLoanPaymentsByMonth, getAllAccounts, getAllCategories } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { LoanPaymentRow } from "@/components/LoanPaymentRow";
import { AddLoanPaymentForm } from "@/components/AddLoanPaymentForm";

export default async function LoansPage() {
  const [groups, accounts, categories] = await Promise.all([
    getLoanPaymentsByMonth(),
    getAllAccounts(),
    getAllCategories(),
  ]);

  const activeAccounts = accounts.filter((a) => !a.archived);
  const activeCategories = categories.filter((c) => !c.archived);

  return (
    <div className="flex flex-col gap-5 pb-4 lg:mx-auto lg:max-w-lg lg:px-4 lg:pt-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold tracking-tight">Upcoming Payments</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loans and recurring bills, by due month
        </p>
      </header>

      {groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
          No upcoming payments logged yet.
        </div>
      )}

      {groups.map((group) => (
        <section key={group.monthKey}>
          <div className="flex items-center justify-between px-1 pb-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {group.label}
            </h2>
            <span className="text-xs font-medium text-zinc-400">
              {formatMoney(group.total)}
              {group.remainingBalance > 0 && ` · ${formatMoney(group.remainingBalance)} left`}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {group.payments.map((loan) => (
              <LoanPaymentRow key={loan.id} loan={loan} accounts={activeAccounts} categories={activeCategories} />
            ))}
          </div>
        </section>
      ))}

      <AddLoanPaymentForm accounts={activeAccounts} categories={activeCategories} />
    </div>
  );
}
