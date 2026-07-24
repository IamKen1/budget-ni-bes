"use client";

import { useState } from "react";
import { updateAccountTarget } from "@/lib/actions/accounts";

export function EditAccountTarget({
  accountId,
  monthlyTarget,
}: {
  accountId: string;
  monthlyTarget: number;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500 transition active:scale-95 dark:bg-zinc-800 dark:text-zinc-400"
      >
        {monthlyTarget > 0 ? "Edit target" : "Set monthly target"}
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updateAccountTarget(formData);
        setOpen(false);
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={accountId} />
      <input
        type="number"
        name="monthlyTarget"
        defaultValue={monthlyTarget}
        min="0"
        step="0.01"
        placeholder="Monthly target"
        className="w-28 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
      />
      <button
        type="submit"
        className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95"
      >
        Save
      </button>
    </form>
  );
}
