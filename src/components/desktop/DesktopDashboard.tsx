import type {
  SerializedAccount,
  SerializedTransaction,
  CategoryProgress,
  LoanPaymentMonthGroup,
} from "@/lib/queries";
import type { Person } from "@/generated/prisma/client";
import { DesktopSidebar } from "@/components/desktop/DesktopSidebar";
import { AddTransactionButton } from "@/components/desktop/AddTransactionButton";
import { DesktopTransactionPanel } from "@/components/desktop/DesktopTransactionPanel";
import { DesktopFilterProvider } from "@/components/desktop/DesktopFilterContext";
import { SpecialDayBanner } from "@/components/SpecialDayBanner";
import { RefreshButton } from "@/components/RefreshButton";

export function DesktopDashboard({
  view,
  cutoff,
  periodLabel,
  totalBalance,
  extraMoney,
  spendingIncome,
  spendingExpense,
  totalCategoryRemaining,
  daddyBalance,
  personSpend,
  totalPersonSpend,
  accounts,
  expenseCategories,
  savingsCategories,
  transactions,
  upcomingLoanGroup,
}: {
  view: "cutoff" | "month";
  cutoff: string;
  periodLabel: string;
  totalBalance: number;
  extraMoney: number;
  spendingIncome: number;
  spendingExpense: number;
  totalCategoryRemaining: number;
  daddyBalance: number;
  personSpend: Record<Person, number>;
  totalPersonSpend: number;
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
          totalBalance={totalBalance}
          extraMoney={extraMoney}
          spendingIncome={spendingIncome}
          spendingExpense={spendingExpense}
          totalCategoryRemaining={totalCategoryRemaining}
          daddyBalance={daddyBalance}
          personSpend={personSpend}
          totalPersonSpend={totalPersonSpend}
          accounts={accounts}
          expenseCategories={expenseCategories}
          savingsCategories={savingsCategories}
          upcomingLoanGroup={upcomingLoanGroup}
        />
        <main className="flex min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between gap-2 px-6 pt-6">
            <SpecialDayBanner />
            <RefreshButton />
          </div>
          <AddTransactionButton accounts={accounts} categories={[...expenseCategories, ...savingsCategories]} />
          <DesktopTransactionPanel transactions={transactions} />
        </main>
      </div>
    </DesktopFilterProvider>
  );
}
