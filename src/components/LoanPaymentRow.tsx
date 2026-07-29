"use client";

import { useState, useTransition } from "react";
import dayjs from "dayjs";
import type { SerializedAccount, SerializedCategory, SerializedLoanPayment } from "@/lib/queries";
import { deleteLoanPayment, toggleLoanPaymentPaid, updateLoanPayment } from "@/lib/actions/loans";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/format";
import { personInitial } from "@/lib/labels";
import { useUndoToast } from "@/components/ToastContext";
import type { Person } from "@/generated/prisma/client";

export function LoanPaymentRow({
  loan,
  accounts,
  categories,
}: {
  loan: SerializedLoanPayment;
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showUndo } = useUndoToast();

  if (editing) {
    return (
      <form
        action={async (formData) => {
          formData.set("id", loan.id);
          const result = await updateLoanPayment(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          if (result?.activityId) showUndo(result.activityId, "Upcoming payment updated");
          setError(null);
          setEditing(false);
        }}
        className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900 dark:bg-emerald-950/20"
      >
        <input
          type="text"
          name="payee"
          defaultValue={loan.payee}
          required
          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
        <div className="flex gap-2">
          <input
            type="date"
            name="dueDate"
            defaultValue={dayjs(loan.dueDate).format("YYYY-MM-DD")}
            required
            className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
          />
          <input
            type="number"
            name="amount"
            defaultValue={loan.amount}
            min="0"
            step="0.01"
            required
            className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
        <input
          type="text"
          name="particulars"
          defaultValue={loan.particulars ?? ""}
          placeholder="Particulars — optional"
          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
        <input
          type="number"
          name="remainingBalance"
          defaultValue={loan.remainingBalance ?? ""}
          placeholder="Remaining balance — optional"
          min="0"
          step="0.01"
          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
        <div className="flex gap-2">
          <select
            name="accountId"
            defaultValue={loan.accountId}
            required
            className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            name="categoryId"
            defaultValue={loan.categoryId ?? ""}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <select
          name="person"
          defaultValue={loan.person}
          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
        >
          {(["SHARED", "JENNA", "KENNETH"] as Person[]).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing(false);
            }}
            className="w-full rounded-lg bg-zinc-100 py-2 text-xs font-semibold text-zinc-600 transition active:scale-95 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition active:scale-95"
          >
            Save
          </button>
        </div>
      </form>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-2 py-2.5 transition ${
        isPending ? "opacity-40" : ""
      } ${loan.paid ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`}
    >
      <input
        type="checkbox"
        checked={loan.paid}
        disabled={isPending}
        aria-label={loan.paid ? "Mark unpaid" : "Mark paid"}
        onChange={() => {
          startTransition(async () => {
            await toggleLoanPaymentPaid(loan.id);
          });
        }}
        className="h-5 w-5 flex-shrink-0 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-700"
      />

      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {personInitial[loan.person]}
      </span>

      <button
        type="button"
        onClick={() => !loan.paid && setEditing(true)}
        disabled={loan.paid}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-medium">
          {loan.payee}{" "}
          <span className="font-normal text-zinc-400">· {formatDate(loan.dueDate)}</span>
        </p>
        {loan.particulars && <p className="truncate text-xs text-zinc-400">{loan.particulars}</p>}
      </button>

      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-semibold">{formatMoney(loan.amount)}</p>
        {loan.remainingBalance !== null && (
          <p className="text-xs text-zinc-400">{formatMoney(loan.remainingBalance)} left</p>
        )}
      </div>

      <button
        type="button"
        aria-label="Delete upcoming payment"
        disabled={isPending || loan.paid}
        onClick={() => {
          if (loan.paid) return;
          if (confirm(`Delete "${loan.payee}"?`)) {
            startTransition(async () => {
              const result = await deleteLoanPayment(loan.id);
              if (result?.activityId) showUndo(result.activityId, "Upcoming payment deleted");
            });
          }
        }}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-zinc-300 transition active:scale-90 active:bg-red-50 active:text-red-500 disabled:opacity-30 dark:text-zinc-600 dark:active:bg-red-950/40"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path
            d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
