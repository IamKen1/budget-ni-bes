import type {
  SerializedAccount,
  SerializedTransaction,
  CategoryProgress,
} from "@/lib/queries";
import { DesktopSidebar } from "@/components/desktop/DesktopSidebar";
import { QuickAddTransactionForm } from "@/components/desktop/QuickAddTransactionForm";
import { DesktopTransactionPanel } from "@/components/desktop/DesktopTransactionPanel";

export function DesktopDashboard({
  cutoff,
  periodLabel,
  totalBalance,
  income,
  expense,
  saved,
  accounts,
  expenseCategories,
  savingsCategories,
  transactions,
}: {
  cutoff: string;
  periodLabel: string;
  totalBalance: number;
  income: number;
  expense: number;
  saved: number;
  accounts: (SerializedAccount & { balance: number })[];
  expenseCategories: CategoryProgress[];
  savingsCategories: CategoryProgress[];
  transactions: SerializedTransaction[];
}) {
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <DesktopSidebar
        cutoff={cutoff}
        periodLabel={periodLabel}
        totalBalance={totalBalance}
        income={income}
        expense={expense}
        saved={saved}
        accounts={accounts}
        expenseCategories={expenseCategories}
        savingsCategories={savingsCategories}
      />
      <main className="flex min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-900/40">
        <QuickAddTransactionForm accounts={accounts} categories={[...expenseCategories, ...savingsCategories]} />
        <DesktopTransactionPanel transactions={transactions} />
      </main>
    </div>
  );
}
