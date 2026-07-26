"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearAllTransactions } from "@/lib/actions/activity";

export function ClearDataForm() {
  const [open, setOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-left text-sm font-medium text-red-600 transition active:scale-[0.99] dark:border-red-950 dark:bg-red-950/30 dark:text-red-400"
      >
        Clear all transactions…
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-950 dark:bg-red-950/30">
      <div>
        <p className="text-sm font-semibold text-red-700 dark:text-red-400">
          Clear all transactions
        </p>
        <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/70">
          Deletes every transaction so all balances reset to zero. Accounts and categories you
          set up stay as-is. This cannot be undone.
        </p>
      </div>

      <input
        type="password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        placeholder="App passcode"
        className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-red-900 dark:bg-zinc-950"
      />
      <input
        type="text"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        placeholder='Type "DELETE" to confirm'
        className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-red-900 dark:bg-zinc-950"
      />

      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await clearAllTransactions(passcode, confirmation);
              if (result.error) {
                setError(result.error);
              } else {
                router.refresh();
                setOpen(false);
                setPasscode("");
                setConfirmation("");
              }
            });
          }}
          className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "Clearing…" : "Permanently clear"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setPasscode("");
            setConfirmation("");
          }}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600 transition active:scale-95 dark:bg-zinc-800 dark:text-zinc-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
