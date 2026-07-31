"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { EntryType, Person } from "@/generated/prisma/client";
import type { SerializedAccount, SerializedCategory } from "@/lib/queries";
import { quickAddTransaction } from "@/lib/actions/transactions";
import { useUndoToast } from "@/components/ToastContext";

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

export function QuickAddTransactionForm({
  accounts,
  categories,
  onSaved,
  bare = false,
}: {
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  /** Called right after a successful save (e.g. to close a modal). */
  onSaved?: () => void;
  /** True when rendered inside its own container (e.g. a modal) — uses a
   * roomier, labeled layout instead of the compact inline toolbar. */
  bare?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [entryType, setEntryType] = useState<EntryType>("EXPENSE");
  const [person, setPerson] = useState<Person>("SHARED");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [isSalaryIncome, setIsSalaryIncome] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showUndo } = useUndoToast();

  const categoryKind =
    entryType === "EXPENSE"
      ? "EXPENSE"
      : entryType === "SAVINGS_DEPOSIT" || entryType === "SAVINGS_WITHDRAW"
      ? "SAVINGS"
      : null;
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === categoryKind),
    [categories, categoryKind]
  );
  const toAccountOptions = accounts.filter((a) => a.id !== accountId);

  const inputClass = bare
    ? "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
    : "w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950";
  const pillClass = (active: boolean, activeTone: "emerald" | "zinc") =>
    `rounded-full font-medium transition ${bare ? "px-3.5 py-2 text-sm" : "px-2.5 py-1 text-[11px]"} ${
      active
        ? activeTone === "emerald"
          ? "bg-emerald-600 text-white"
          : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
    }`;

  const form = (
    <form
      ref={formRef}
      action={(formData) => {
        startTransition(async () => {
          const result = await quickAddTransaction(formData);
          if (result?.activityId) {
            showUndo(result.activityId, "Transaction logged");
            formRef.current?.reset();
            setEntryType("EXPENSE");
            setPerson("SHARED");
            setIsSalaryIncome(false);
            onSaved?.();
          }
        });
      }}
      className={
        bare
          ? "flex flex-col gap-4"
          : "flex flex-col gap-2 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950"
      }
    >
      <input type="hidden" name="entryType" value={entryType} />
      <input type="hidden" name="person" value={person} />
      {entryType === "INCOME" && isSalaryIncome && <input type="hidden" name="isSalaryIncome" value="true" />}

      <div className="flex flex-wrap items-center gap-1.5">
        {entryTypeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setEntryType(opt.value)}
            className={pillClass(entryType === opt.value, "emerald")}
          >
            {opt.label}
          </button>
        ))}
        <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
        {entryType === "INCOME" && (
          <button
            type="button"
            onClick={() => setIsSalaryIncome((v) => !v)}
            title="Counts toward Deposits on the dashboard if checked"
            className={pillClass(isSalaryIncome, "emerald")}
          >
            {isSalaryIncome ? "✓ Salary" : "Salary?"}
          </button>
        )}
        {personOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPerson(opt.value)}
            className={pillClass(person === opt.value, "zinc")}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {bare ? (
        <>
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-zinc-200 bg-zinc-50 py-5 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-xs font-medium text-zinc-400">Amount</span>
            <div className="flex items-center gap-1">
              <span className="text-xl font-semibold text-zinc-400">₱</span>
              <input
                type="number"
                name="amount"
                inputMode="decimal"
                step="0.01"
                min="0"
                required
                autoFocus
                placeholder="0.00"
                className="w-40 bg-transparent text-center text-2xl font-semibold tracking-tight outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Account">
              <select
                name="accountId"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                className={inputClass}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>

            {entryType === "TRANSFER" ? (
              <Field label="To Account">
                <select name="toAccountId" required className={inputClass}>
                  {toAccountOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Category">
                <select name="categoryId" required className={inputClass}>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" name="date" defaultValue={todayISO()} required className={inputClass} />
            </Field>
            <Field label="Note (optional)">
              <input type="text" name="particulars" placeholder="e.g. Grocery run" className={inputClass} />
            </Field>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Add Transaction"}
          </button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-6 items-center gap-1.5">
            <input
              type="number"
              name="amount"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              placeholder="₱ Amount"
              className={`${inputClass} col-span-1`}
            />
            <select
              name="accountId"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className={`${inputClass} col-span-1`}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {entryType === "TRANSFER" ? (
              <select name="toAccountId" required className={`${inputClass} col-span-1`}>
                {toAccountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <select name="categoryId" required className={`${inputClass} col-span-1`}>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <input
              type="text"
              name="particulars"
              placeholder="Note (optional)"
              className={`${inputClass} col-span-2`}
            />
            <input type="date" name="date" defaultValue={todayISO()} required className={`${inputClass} col-span-1`} />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="self-end rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Add Transaction"}
          </button>
        </>
      )}
    </form>
  );

  return form;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="px-1 text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
