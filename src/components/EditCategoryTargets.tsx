"use client";

import { useState } from "react";
import { updateCategoryTargets } from "@/lib/actions/categories";
import { useUndoToast } from "@/components/ToastContext";

export function EditCategoryTargets({
  categoryId,
  monthlyTarget,
  goalTarget,
  firstHalfTarget,
  showGoal,
}: {
  categoryId: string;
  monthlyTarget: number;
  goalTarget: number;
  firstHalfTarget?: number;
  showGoal: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { showUndo } = useUndoToast();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500 transition active:scale-95 dark:bg-zinc-800 dark:text-zinc-400"
      >
        Edit target
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        const result = await updateCategoryTargets(formData);
        if (result?.activityId) showUndo(result.activityId, "Targets updated");
        setOpen(false);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="id" value={categoryId} />
      <input
        type="number"
        name="monthlyTarget"
        defaultValue={monthlyTarget}
        min="0"
        step="0.01"
        placeholder="Monthly"
        className="w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
      />
      {firstHalfTarget !== undefined && (
        <input
          type="number"
          name="firstHalfTarget"
          defaultValue={firstHalfTarget}
          min="0"
          step="0.01"
          placeholder="1-15 cutoff"
          title="Budget target for the 1-15 cutoff — the 16-end cutoff gets the remainder of the monthly target"
          className="w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
      )}
      {showGoal && (
        <input
          type="number"
          name="goalTarget"
          defaultValue={goalTarget}
          min="0"
          step="0.01"
          placeholder="Goal"
          className="w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
      )}
      {!showGoal && <input type="hidden" name="goalTarget" value="0" />}
      <button
        type="submit"
        className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95"
      >
        Save
      </button>
    </form>
  );
}
