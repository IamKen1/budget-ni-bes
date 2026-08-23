import Link from "next/link";
import dayjs from "dayjs";
import { getAllTransactions, monthRange, cutoffRange, type SerializedTransaction } from "@/lib/queries";
import { formatMoney, formatDateFull } from "@/lib/format";
import { DeletableTransactionRow } from "@/components/DeletableTransactionRow";

function groupByDate(transactions: SerializedTransaction[]): [string, SerializedTransaction[]][] {
  const groups = new Map<string, SerializedTransaction[]>();
  for (const tx of transactions) {
    const key = formatDateFull(tx.date);
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }
  return Array.from(groups.entries());
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; all?: string }>;
}) {
  const { from: fromParam, to: toParam, all } = await searchParams;

  // Neither param given -> defaults to this month. Only one given -> open-ended
  // on the missing side (from epoch, or through today). "all=1" -> no bounds
  // at all, ignoring from/to entirely.
  let start: dayjs.Dayjs | null = null;
  let end: dayjs.Dayjs | null = null;
  let rangeLabel: string;
  if (all) {
    rangeLabel = "All Time";
  } else if (fromParam || toParam) {
    start = fromParam ? dayjs(fromParam).startOf("day") : dayjs(0);
    end = toParam ? dayjs(toParam).endOf("day") : dayjs().endOf("day");
    rangeLabel = `${start.format("MMM D, YYYY")} – ${end.format("MMM D, YYYY")}`;
  } else {
    const range = monthRange();
    start = dayjs(range.start);
    end = dayjs(range.end);
    rangeLabel = `${start.format("MMM D, YYYY")} – ${end.format("MMM D, YYYY")}`;
  }

  const [incomeOnlyTx, expenseTx, savingsWithdrawTx] = await Promise.all([
    getAllTransactions({ entryType: "INCOME", from: start?.toDate(), to: end?.toDate() }),
    getAllTransactions({ entryType: "EXPENSE", from: start?.toDate(), to: end?.toDate() }),
    getAllTransactions({ entryType: "SAVINGS_WITHDRAW", from: start?.toDate(), to: end?.toDate() }),
  ]);

  // Savings withdrawals count as money coming in (available to spend again) —
  // shown mixed into the Incoming list rather than a separate section, with
  // TransactionRow's own "Savings Withdrawn" badge telling them apart from
  // real income.
  const incomeTx = [...incomeOnlyTx, ...savingsWithdrawTx].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const totalIncoming = incomeTx.reduce((s, t) => s + t.amount, 0);
  const totalOutgoing = expenseTx.reduce((s, t) => s + t.amount, 0);
  const net = totalIncoming - totalOutgoing;

  const cutoff = cutoffRange();
  const lastMonth = dayjs().subtract(1, "month");
  const presets = [
    { href: "/reports", label: "This Month" },
    {
      href: `/reports?from=${lastMonth.startOf("month").format("YYYY-MM-DD")}&to=${lastMonth
        .endOf("month")
        .format("YYYY-MM-DD")}`,
      label: "Last Month",
    },
    {
      href: `/reports?from=${dayjs(cutoff.start).format("YYYY-MM-DD")}&to=${dayjs(cutoff.end).format("YYYY-MM-DD")}`,
      label: "This Cutoff",
    },
    { href: "/reports?all=1", label: "All Time" },
  ];

  return (
    <div className="flex flex-col gap-5 pb-4 lg:mx-auto lg:max-w-lg lg:px-4 lg:pt-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{rangeLabel}</p>
      </header>

      <form className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="px-1 text-xs font-medium text-zinc-400">From</span>
          <input
            type="date"
            name="from"
            defaultValue={start && !all ? start.format("YYYY-MM-DD") : ""}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="px-1 text-xs font-medium text-zinc-400">To</span>
          <input
            type="date"
            name="to"
            defaultValue={end && !all ? end.format("YYYY-MM-DD") : ""}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          className="h-[38px] flex-shrink-0 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition active:scale-95"
        >
          Go
        </button>
      </form>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-0.5 pb-0.5">
        {presets.map((p) => (
          <Link
            key={p.label}
            href={p.href}
            className="flex-shrink-0 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 transition active:scale-95 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-400">Incoming</p>
          <p className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            {formatMoney(totalIncoming)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-400">Outgoing</p>
          <p className="mt-1 text-lg font-semibold text-red-500 dark:text-red-400">
            {formatMoney(totalOutgoing)}
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium text-zinc-400">Net</p>
        <p
          className={`mt-1 text-xl font-semibold ${
            net < 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {formatMoney(net)}
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Incoming</h2>
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {formatMoney(totalIncoming)}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {groupByDate(incomeTx).map(([date, txs]) => (
            <div key={date}>
              <h3 className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{date}</h3>
              <div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                {txs.map((tx) => (
                  <DeletableTransactionRow key={tx.id} transaction={tx} />
                ))}
              </div>
            </div>
          ))}
          {incomeTx.length === 0 && <p className="px-1 text-sm text-zinc-400">Walang incoming this range.</p>}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Outgoing</h2>
          <span className="text-sm font-semibold text-red-500 dark:text-red-400">{formatMoney(totalOutgoing)}</span>
        </div>
        <div className="flex flex-col gap-3">
          {groupByDate(expenseTx).map(([date, txs]) => (
            <div key={date}>
              <h3 className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{date}</h3>
              <div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                {txs.map((tx) => (
                  <DeletableTransactionRow key={tx.id} transaction={tx} />
                ))}
              </div>
            </div>
          ))}
          {expenseTx.length === 0 && <p className="px-1 text-sm text-zinc-400">Walang outgoing this range.</p>}
        </div>
      </section>
    </div>
  );
}
