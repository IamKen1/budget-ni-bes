"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { EntryType, Person } from "@/generated/prisma/client";
import type { SerializedAccount, SerializedCategory } from "@/lib/queries";
import { createTransaction } from "@/lib/actions/transactions";
import { accountTypeLabel } from "@/lib/labels";

const entryTypeOptions: { value: EntryType; label: string }[] = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "SAVINGS_DEPOSIT", label: "Save" },
  { value: "SAVINGS_WITHDRAW", label: "Withdraw" },
  { value: "TRANSFER", label: "Transfer" },
];

const personOptions: { value: Person; label: string }[] = [
  { value: "SHARED", label: "Shared" },
  { value: "JENNA", label: "Jenna" },
  { value: "KENNETH", label: "Kenneth" },
];

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function NewTransactionForm({
  accounts,
  categories,
}: {
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
}) {
  const router = useRouter();
  const [entryType, setEntryType] = useState<EntryType>("EXPENSE");
  const [person, setPerson] = useState<Person>("SHARED");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");

  const categoryKind = entryType === "EXPENSE" ? "EXPENSE" : entryType === "SAVINGS_DEPOSIT" || entryType === "SAVINGS_WITHDRAW" ? "SAVINGS" : null;
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === categoryKind),
    [categories, categoryKind]
  );
  const toAccountOptions = accounts.filter((a) => a.id !== accountId);

  return (
    <form action={createTransaction} className="flex flex-col gap-5">
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Cancel"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 dark:bg-zinc-900 dark:text-zinc-400"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="text-base font-semibold">New Transaction</h1>
        <div className="w-10" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {entryTypeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setEntryType(opt.value)}
            className={`rounded-xl px-2 py-2.5 text-sm font-medium transition active:scale-95 ${
              entryType === opt.value
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <input type="hidden" name="entryType" value={entryType} />

      <div className="flex flex-col items-center gap-1 rounded-2xl border border-zinc-200 bg-white py-6 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-xs font-medium text-zinc-400">Amount</span>
        <div className="flex items-center gap-1">
          <span className="text-2xl font-semibold text-zinc-400">₱</span>
          <input
            type="number"
            name="amount"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            autoFocus
            placeholder="0.00"
            className="w-40 bg-transparent text-center text-3xl font-semibold tracking-tight outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Field label="Date">
          <input
            type="date"
            name="date"
            defaultValue={todayISO()}
            required
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </Field>

        <Field label="Account">
          <select
            name="accountId"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({accountTypeLabel[a.type]})
              </option>
            ))}
          </select>
        </Field>

        {entryType === "TRANSFER" ? (
          <Field label="To Account">
            <select
              name="toAccountId"
              required
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {toAccountOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({accountTypeLabel[a.type]})
                </option>
              ))}
            </select>
          </Field>
        ) : categoryKind !== null ? (
          <Field label="Category">
            <select
              name="categoryId"
              required
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Who">
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
        </Field>

        <Field label="Note (optional)">
          <input
            type="text"
            name="particulars"
            placeholder="e.g. Grocery run"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </Field>

        {entryType === "INCOME" && (
          <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <input type="checkbox" name="isSalaryIncome" value="true" className="h-4 w-4 accent-emerald-600" />
            This is salary — counts toward "Deposits" on the dashboard (leave unchecked for interest, reimbursements, or other one-off deposits)
          </label>
        )}
      </div>

      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-semibold text-white shadow-sm shadow-emerald-600/20 transition active:scale-[0.98] active:bg-emerald-700"
      >
        Save Transaction
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="px-1 text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
