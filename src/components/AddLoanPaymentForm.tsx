"use client";

import { useRef, useState } from "react";
import type { Person } from "@/generated/prisma/client";
import type { SerializedAccount, SerializedCategory } from "@/lib/queries";
import { createLoanPayment } from "@/lib/actions/loans";
import { useUndoToast } from "@/components/ToastContext";

const personOptions: { value: Person; label: string }[] = [
  { value: "SHARED", label: "Shared" },
  { value: "JENNA", label: "Jenna" },
  { value: "KENNETH", label: "Kenneth" },
];

export function AddLoanPaymentForm({
  accounts,
  categories,
}: {
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [person, setPerson] = useState<Person>("SHARED");
  const { showUndo } = useUndoToast();

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        const result = await createLoanPayment(formData);
        if (result?.activityId) showUndo(result.activityId, "Upcoming payment added");
        formRef.current?.reset();
        setPerson("SHARED");
      }}
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="text-sm font-semibold">Add Upcoming Payment</p>

      <input
        type="text"
        name="payee"
        placeholder="Payee (e.g. RCBC 3003)"
        required
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
      />

      <div className="flex gap-3">
        <input
          type="date"
          name="dueDate"
          required
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
        <input
          type="number"
          name="amount"
          placeholder="Amount"
          min="0"
          step="0.01"
          required
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>

      <input
        type="text"
        name="particulars"
        placeholder="Particulars (e.g. End by Aug) — optional"
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
      />

      <input
        type="number"
        name="remainingBalance"
        placeholder="Remaining balance — optional"
        min="0"
        step="0.01"
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
      />

      <select
        name="accountId"
        required
        defaultValue={accounts[0]?.id ?? ""}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <select
        name="categoryId"
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-3 gap-2">
        {personOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPerson(opt.value)}
            className={`rounded-xl px-2 py-2 text-sm font-medium transition active:scale-95 ${
              person === opt.value
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <input type="hidden" name="person" value={person} />

      <button
        type="submit"
        className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900"
      >
        Add Upcoming Payment
      </button>
    </form>
  );
}
