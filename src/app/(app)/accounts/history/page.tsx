import Link from "next/link";
import { getMonthlyAccountBalanceHistory } from "@/lib/queries";
import { formatMoney } from "@/lib/format";

export default async function AccountBalanceHistoryPage() {
  const { accounts, rows } = await getMonthlyAccountBalanceHistory();

  return (
    <div className="flex flex-col gap-5 pb-4 lg:mx-auto lg:max-w-2xl lg:px-4 lg:pt-6">
      <header className="flex items-center gap-3 pt-2">
        <Link
          href="/accounts"
          aria-label="Back to Accounts"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Balance History</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ending balance per account, end of each month
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
          No transactions yet, so there&apos;s no history to show.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Month
                </th>
                {accounts.map((account) => (
                  <th
                    key={account.id}
                    className={`whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400 ${
                      account.archived ? "opacity-50" : ""
                    }`}
                  >
                    {account.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.monthKey} className="border-b border-zinc-50 last:border-0 dark:border-zinc-900">
                  <td className="whitespace-nowrap px-4 py-3 font-medium">{row.label}</td>
                  {accounts.map((account) => (
                    <td key={account.id} className="whitespace-nowrap px-4 py-3 text-right">
                      {formatMoney(row.balances[account.id] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
