"use client";

import { useTransition } from "react";
import type { SerializedTransaction } from "@/lib/queries";
import { TransactionRow } from "@/components/TransactionRow";
import { deleteTransaction } from "@/lib/actions/transactions";
import { useUndoToast } from "@/components/ToastContext";

export function DeletableTransactionRow({
  transaction,
}: {
  transaction: SerializedTransaction;
}) {
  const [isPending, startTransition] = useTransition();
  const { showUndo } = useUndoToast();

  return (
    <div className={`flex items-center gap-1 ${isPending ? "opacity-40" : ""}`}>
      <div className="min-w-0 flex-1">
        <TransactionRow transaction={transaction} />
      </div>
      <button
        type="button"
        aria-label="Delete transaction"
        disabled={isPending}
        onClick={() => {
          if (confirm("Delete this transaction?")) {
            startTransition(async () => {
              const result = await deleteTransaction(transaction.id);
              if (result?.activityId) showUndo(result.activityId, "Transaction deleted");
            });
          }
        }}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-zinc-300 transition active:scale-90 active:bg-red-50 active:text-red-500 dark:text-zinc-600 dark:active:bg-red-950/40"
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
