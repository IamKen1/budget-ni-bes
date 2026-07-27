"use client";

import { useState } from "react";
import { updateAccountName } from "@/lib/actions/accounts";
import { useUndoToast } from "@/components/ToastContext";

export function EditAccountName({ accountId, name }: { accountId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showUndo } = useUndoToast();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Rename account"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-zinc-400 transition active:scale-90"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
          <path
            d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <form
        action={async (formData) => {
          setError(null);
          const result = await updateAccountName(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          if (result?.activityId) showUndo(result.activityId, "Account renamed");
          setOpen(false);
        }}
        className="flex items-center gap-1.5"
      >
        <input type="hidden" name="id" value={accountId} />
        <input
          type="text"
          name="name"
          defaultValue={name}
          autoFocus
          maxLength={60}
          className="w-32 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
        <button
          type="submit"
          className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition active:scale-95"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs text-zinc-400"
        >
          Cancel
        </button>
      </form>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
