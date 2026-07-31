"use client";

import { useState } from "react";
import type { SerializedAccount, SerializedCategory } from "@/lib/queries";
import { QuickAddTransactionForm } from "@/components/desktop/QuickAddTransactionForm";

export function AddTransactionButton({
  accounts,
  categories,
}: {
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold">Transactions</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition active:scale-95"
        >
          + Add Transaction
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-7 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Transaction</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 dark:bg-zinc-900 dark:text-zinc-400"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5">
                  <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <QuickAddTransactionForm accounts={accounts} categories={categories} onSaved={() => setOpen(false)} bare />
          </div>
        </div>
      )}
    </>
  );
}
