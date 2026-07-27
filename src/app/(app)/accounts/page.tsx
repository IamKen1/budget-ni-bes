import Link from "next/link";
import { getAllAccounts, getAccountsWithBalances } from "@/lib/queries";
import { accountTypeLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/format";
import { AddAccountForm } from "@/components/AddAccountForm";
import { ArchiveToggleButton } from "@/components/ArchiveToggleButton";
import { EditAccountTarget } from "@/components/EditAccountTarget";
import { EditAccountName } from "@/components/EditAccountName";
import { ReorderAccountButtons } from "@/components/ReorderAccountButtons";
import { toggleArchiveAccount } from "@/lib/actions/accounts";
import { ProgressBar } from "@/components/ProgressBar";

export default async function AccountsPage() {
  const [accounts, withBalances] = await Promise.all([
    getAllAccounts(),
    getAccountsWithBalances(),
  ]);
  const balanceById = new Map(withBalances.map((a) => [a.id, a.balance]));

  return (
    <div className="flex flex-col gap-5 pb-4 lg:mx-auto lg:max-w-lg lg:px-4 lg:pt-6">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Bank, cash, and e-wallet balances
          </p>
        </div>
        <Link href="/accounts/history" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          History
        </Link>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {accounts.map((account, index) => {
          const balance = balanceById.get(account.id) ?? 0;
          return (
            <div key={account.id} className={account.archived ? "opacity-50" : ""}>
              <div className="flex items-center justify-between gap-3 rounded-xl py-1">
                <div className="flex min-w-0 items-center gap-2">
                  <ReorderAccountButtons
                    accountId={account.id}
                    isFirst={index === 0}
                    isLast={index === accounts.length - 1}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="truncate text-sm font-medium">{account.name}</p>
                      {!account.archived && <EditAccountName accountId={account.id} name={account.name} />}
                    </div>
                    <p className="text-xs text-zinc-400">{accountTypeLabel[account.type]}</p>
                  </div>
                </div>
                {!account.archived && (
                  <p className="text-sm font-semibold">{formatMoney(balance)}</p>
                )}
              </div>

              {!account.archived && account.monthlyTarget > 0 && (
                <div className="mt-2">
                  <ProgressBar
                    label="This month's budget"
                    value={balance}
                    target={account.monthlyTarget}
                    showVariance={false}
                  />
                </div>
              )}

              <div className="mt-2 flex items-center justify-between">
                <EditAccountTarget accountId={account.id} monthlyTarget={account.monthlyTarget} />
                <ArchiveToggleButton
                  id={account.id}
                  archived={account.archived}
                  toggleAction={toggleArchiveAccount}
                />
              </div>
            </div>
          );
        })}
        {accounts.length === 0 && (
          <p className="p-3 text-sm text-zinc-400">No accounts yet.</p>
        )}
      </div>

      <AddAccountForm />
    </div>
  );
}
