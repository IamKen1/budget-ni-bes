import type {
  SerializedAccount,
  SerializedTransaction,
  CategoryProgress,
  LoanPaymentMonthGroup,
} from "@/lib/queries";
import { DesktopSidebar } from "@/components/desktop/DesktopSidebar";
import { AddTransactionButton } from "@/components/desktop/AddTransactionButton";
import { DesktopTransactionPanel } from "@/components/desktop/DesktopTransactionPanel";
import { DesktopFilterProvider } from "@/components/desktop/DesktopFilterContext";
import { SpecialDayBanner } from "@/components/SpecialDayBanner";

export function DesktopDashboard({
  view,
  cutoff,
  periodLabel,
  periodStart,
  periodEnd,
  totalBalance,
  income,
  expense,
  saved,
  accounts,
  expenseCategories,
  savingsCategories,
  transactions,
  upcomingLoanGroup,
}: {
  view: "cutoff" | "month";
  cutoff: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  totalBalance: number;
  income: number;
  expense: number;
  saved: number;
  accounts: (SerializedAccount & { balance: number })[];
  expenseCategories: CategoryProgress[];
  savingsCategories: CategoryProgress[];
  transactions: SerializedTransaction[];
  upcomingLoanGroup: LoanPaymentMonthGroup | null;
}) {
  return (
    <DesktopFilterProvider>
      <div className="flex h-dvh w-full overflow-hidden">
        <DesktopSidebar
          view={view}
          cutoff={cutoff}
          periodLabel={periodLabel}
          periodStart={periodStart}
          periodEnd={periodEnd}
          totalBalance={totalBalance}
          income={income}
          expense={expense}
          saved={saved}
          accounts={accounts}
          expenseCategories={expenseCategories}
          savingsCategories={savingsCategories}
          upcomingLoanGroup={upcomingLoanGroup}
        />
        <main className="flex min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-900/40">
          <div className="px-6 pt-6">
            <SpecialDayBanner />
          </div>
          <AddTransactionButton accounts={accounts} categories={[...expenseCategories, ...savingsCategories]} />
          <DesktopTransactionPanel transactions={transactions} />
        </main>
      </div>
    </DesktopFilterProvider>
  );
}
