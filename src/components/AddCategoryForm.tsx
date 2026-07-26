"use client";

import { useRef, useState } from "react";
import type { CategoryKind } from "@/generated/prisma/client";
import { createCategory } from "@/lib/actions/categories";
import { useUndoToast } from "@/components/ToastContext";

export function AddCategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<CategoryKind>("EXPENSE");
  const { showUndo } = useUndoToast();

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        const result = await createCategory(formData);
        if (result?.activityId) showUndo(result.activityId, "Category added");
        formRef.current?.reset();
        setKind("EXPENSE");
      }}
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="text-sm font-semibold">Add Category</p>
      <input
        type="text"
        name="name"
        placeholder="Category name"
        required
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
      />
      <div className="flex gap-3">
        <select
          name="kind"
          required
          value={kind}
          onChange={(e) => setKind(e.target.value as CategoryKind)}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="EXPENSE">Expense</option>
          <option value="SAVINGS">Savings</option>
        </select>
        <input
          type="number"
          name="monthlyTarget"
          placeholder="Monthly target"
          min="0"
          step="0.01"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>
      {kind === "SAVINGS" && (
        <input
          type="number"
          name="goalTarget"
          placeholder="Overall goal (optional)"
          min="0"
          step="0.01"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
      )}
      <button
        type="submit"
        className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900"
      >
        Add Category
      </button>
    </form>
  );
}
