"use client";

import { useState } from "react";
import { updateCategoryTargets } from "@/lib/actions/categories";
import { useUndoToast } from "@/components/ToastContext";
import { formatMoney } from "@/lib/format";

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm tabular-nums outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950";

export function EditCategoryTargets({
  categoryId,
  monthlyTarget,
  goalTarget,
  firstHalfTarget,
  isCommittedSpend,
  showGoal,
  onDone,
}: {
  categoryId: string;
  monthlyTarget: number;
  goalTarget: number;
  firstHalfTarget?: number;
  isCommittedSpend?: boolean;
  showGoal: boolean;
  /** When given, the parent controls visibility (form is always shown and calls this on save/cancel).
   * When omitted, the component renders its own "Edit target" toggle button. */
  onDone?: () => void;
}) {
  const [selfOpen, setSelfOpen] = useState(false);
  const [committed, setCommitted] = useState(isCommittedSpend ?? false);
  const [monthly, setMonthly] = useState(String(monthlyTarget));
  const [firstHalf, setFirstHalf] = useState(String(firstHalfTarget ?? ""));
  const { showUndo } = useUndoToast();

  const hasCutoff = firstHalfTarget !== undefined;
  const secondHalf = Math.max(0, (Number(monthly) || 0) - (Number(firstHalf) || 0));
  const close = onDone ?? (() => setSelfOpen(false));

  if (!onDone && !selfOpen) {
    return (
      <button
        type="button"
        onClick={() => setSelfOpen(true)}
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
        close();
      }}
      className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60"
    >
      <input type="hidden" name="id" value={categoryId} />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          Monthly target
          <input
            type="number"
            name="monthlyTarget"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            min="0"
            step="0.01"
            inputMode="decimal"
            required
            autoFocus
            className={inputClass}
          />
        </label>

        {hasCutoff && (
          <label className="flex flex-col gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            1–15 cutoff
            <input
              type="number"
              name="firstHalfTarget"
              value={firstHalf}
              onChange={(e) => setFirstHalf(e.target.value)}
              min="0"
              step="0.01"
              inputMode="decimal"
              className={inputClass}
            />
          </label>
        )}

        {showGoal && (
          <label className="flex flex-col gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Overall goal
            <input
              type="number"
              name="goalTarget"
              defaultValue={goalTarget}
              min="0"
              step="0.01"
              inputMode="decimal"
              className={inputClass}
            />
          </label>
        )}
      </div>
      {!showGoal && <input type="hidden" name="goalTarget" value="0" />}

      {hasCutoff && (
        <p className="-mt-1 text-[11px] text-zinc-400">
          16–end cutoff gets the rest: <span className="font-medium">{formatMoney(secondHalf)}</span>
        </p>
      )}

      {hasCutoff && (
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={committed}
            onChange={(e) => setCommitted(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-emerald-600"
          />
          {committed && <input type="hidden" name="isCommittedSpend" value="true" />}
          <span>
            <span className="font-medium">Committed spend</span>
            <span className="block text-[11px] text-zinc-400">
              Guaranteed future expense (like Baon) — subtracted from Bes AI&apos;s float money, same as an
              unpaid loan.
            </span>
          </span>
        </label>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={close}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition active:scale-95 dark:text-zinc-400"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition active:scale-95"
        >
          Save
        </button>
      </div>
    </form>
  );
}
