"use client";

import { useRef, useState } from "react";
import type { CategoryKind } from "@/generated/prisma/client";
import { createCategory } from "@/lib/actions/categories";
import { useUndoToast } from "@/components/ToastContext";

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950";

export function AddCategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CategoryKind>("EXPENSE");
  const { showUndo } = useUndoToast();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-500 transition active:scale-[0.98] dark:border-zinc-700 dark:text-zinc-400"
      >
        + Add category
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        const result = await createCategory(formData);
        if (result?.activityId) showUndo(result.activityId, "Category added");
        formRef.current?.reset();
        setKind("EXPENSE");
        setOpen(false);
      }}
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex gap-0.5 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-950">
        {(["EXPENSE", "SAVINGS"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`flex-1 rounded-full py-1.5 text-xs font-medium transition ${
              kind === k
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {k === "EXPENSE" ? "Expense" : "Savings fund"}
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />
      <input type="text" name="name" placeholder="Category name" required autoFocus className={inputClass} />
      <div className="flex gap-3">
        <input
          type="number"
          name="monthlyTarget"
          placeholder="Monthly target"
          min="0"
          step="0.01"
          inputMode="decimal"
          className={inputClass}
        />
        {kind === "SAVINGS" && (
          <input
            type="number"
            name="goalTarget"
            placeholder="Overall goal"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={inputClass}
          />
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-500 transition active:scale-[0.98] dark:text-zinc-400"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add {kind === "EXPENSE" ? "expense category" : "savings fund"}
        </button>
      </div>
    </form>
  );
}
