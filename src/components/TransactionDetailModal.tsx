"use client";

import { useEffect, useState, useTransition } from "react";
import { useTransactionDetail } from "@/components/TransactionDetailContext";
import { useUndoToast } from "@/components/ToastContext";
import { updateTransactionFields, deleteTransaction } from "@/lib/actions/transactions";
import { getTransactionFormOptions } from "@/lib/actions/formOptions";
import { formatMoney, formatDateFull } from "@/lib/format";
import { entryTypeLabel, personLabel, accountTypeLabel } from "@/lib/labels";
import type { EntryType, Person } from "@/generated/prisma/client";
import type { SerializedAccount, SerializedCategory, SerializedTransaction } from "@/lib/queries";

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

function toDateInputValue(date: Date | string) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function TransactionDetailModal() {
  const { transaction, close } = useTransactionDetail();
  // Account/category options don't depend on which transaction is open, so they're
  // fetched once (lazily, on first open) and reused — not reset per transaction.
  const [options, setOptions] = useState<{ accounts: SerializedAccount[]; categories: SerializedCategory[] } | null>(
    null
  );

  useEffect(() => {
    if (transaction && !options) {
      getTransactionFormOptions().then(setOptions);
    }
  }, [transaction, options]);

  if (!transaction) return null;

  // Keying by transaction id remounts the body fresh whenever a different
  // transaction is opened, resetting its local mode/error state naturally
  // instead of needing an effect to do it.
  return <TransactionDetailBody key={transaction.id} transaction={transaction} options={options} close={close} />;
}

function TransactionDetailBody({
  transaction,
  options,
  close,
}: {
  transaction: SerializedTransaction;
  options: { accounts: SerializedAccount[]; categories: SerializedCategory[] } | null;
  close: () => void;
}) {
  const { showUndo } = useUndoToast();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const title =
    transaction.entryType === "TRANSFER"
      ? `${transaction.account.name} → ${transaction.toAccount?.name ?? ""}`
      : transaction.particulars || transaction.category?.name || entryTypeLabel[transaction.entryType];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 lg:items-center"
      onClick={close}
    >
      <div
        className="flex max-h-[90dvh] w-full flex-col overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-zinc-950 lg:w-full lg:max-w-sm lg:rounded-3xl lg:border lg:border-zinc-200 lg:dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{mode === "edit" ? "Edit Transaction" : "Transaction"}</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 dark:bg-zinc-900 dark:text-zinc-400"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {mode === "view" ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-2xl bg-zinc-50 p-4 text-center dark:bg-zinc-900">
              <p className="text-sm text-zinc-500">{title}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {formatMoney(transaction.amount)}
              </p>
            </div>

            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Type" value={entryTypeLabel[transaction.entryType]} />
              <Row label="Date" value={formatDateFull(transaction.date)} />
              <Row label="Account" value={transaction.account.name} />
              {transaction.toAccount && <Row label="To Account" value={transaction.toAccount.name} />}
              {transaction.category && <Row label="Category" value={transaction.category.name} />}
              <Row label="Who" value={personLabel[transaction.person]} />
              {transaction.entryType === "INCOME" && (
                <Row label="Salary?" value={transaction.isSalaryIncome ? "Yes — counts as Deposits" : "No"} />
              )}
              {transaction.particulars && <Row label="Note" value={transaction.particulars} />}
            </dl>

            {error && <p className="text-xs font-medium text-red-500">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!confirm("Delete this transaction?")) return;
                  startTransition(async () => {
                    const result = await deleteTransaction(transaction.id);
                    if (result?.error) {
                      setError(result.error);
                    } else {
                      if (result?.activityId) showUndo(result.activityId, "Transaction deleted");
                      close();
                    }
                  });
                }}
                className="flex-1 rounded-xl bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition active:scale-[0.98] disabled:opacity-50 dark:bg-red-950/40 dark:text-red-400"
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <EditForm
            transaction={transaction}
            options={options}
            error={error}
            isPending={isPending}
            onCancel={() => setMode("view")}
            onSubmit={(formData) => {
              setError(null);
              startTransition(async () => {
                const result = await updateTransactionFields(formData);
                if (result?.error) {
                  setError(result.error);
                } else {
                  if (result?.activityId) showUndo(result.activityId, "Transaction updated");
                  close();
                }
              });
            }}
          />
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-900">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function EditForm({
  transaction,
  options,
  error,
  isPending,
  onCancel,
  onSubmit,
}: {
  transaction: NonNullable<ReturnType<typeof useTransactionDetail>["transaction"]>;
  options: { accounts: SerializedAccount[]; categories: SerializedCategory[] } | null;
  error: string | null;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const [entryType, setEntryType] = useState<EntryType>(transaction.entryType as EntryType);
  const [person, setPerson] = useState<Person>(transaction.person);
  const [accountId, setAccountId] = useState(transaction.account.id);
  const [isSalaryIncome, setIsSalaryIncome] = useState(transaction.isSalaryIncome);

  if (!options) {
    return <p className="mt-6 py-8 text-center text-sm text-zinc-400">Loading…</p>;
  }

  const categoryKind =
    entryType === "EXPENSE"
      ? "EXPENSE"
      : entryType === "SAVINGS_DEPOSIT" || entryType === "SAVINGS_WITHDRAW"
      ? "SAVINGS"
      : null;
  const filteredCategories = options.categories.filter((c) => c.kind === categoryKind);
  const toAccountOptions = options.accounts.filter((a) => a.id !== accountId);

  return (
    <form action={onSubmit} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="id" value={transaction.id} />
      <input type="hidden" name="entryType" value={entryType} />
      <input type="hidden" name="person" value={person} />
      {entryType === "INCOME" && isSalaryIncome && <input type="hidden" name="isSalaryIncome" value="true" />}

      <div className="grid grid-cols-3 gap-2">
        {entryTypeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setEntryType(opt.value)}
            className={`rounded-xl px-2 py-2 text-xs font-medium transition ${
              entryType === opt.value
                ? "bg-emerald-600 text-white"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Field label="Amount">
        <input
          type="number"
          name="amount"
          inputMode="decimal"
          step="0.01"
          min="0"
          required
          defaultValue={transaction.amount}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
        />
      </Field>

      <Field label="Date">
        <input
          type="date"
          name="date"
          defaultValue={toDateInputValue(transaction.date)}
          required
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
        />
      </Field>

      <Field label="Account">
        <select
          name="accountId"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          required
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {options.accounts.map((a) => (
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
            defaultValue={transaction.toAccount?.id}
            required
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {toAccountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Category">
          <select
            name="categoryId"
            defaultValue={transaction.category?.id}
            required
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Who">
        <div className="grid grid-cols-3 gap-2">
          {personOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPerson(opt.value)}
              className={`rounded-xl px-2 py-2 text-xs font-medium transition ${
                person === opt.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Note">
        <input
          type="text"
          name="particulars"
          defaultValue={transaction.particulars ?? ""}
          placeholder="Optional"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
        />
      </Field>

      {entryType === "INCOME" && (
        <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <input
            type="checkbox"
            checked={isSalaryIncome}
            onChange={(e) => setIsSalaryIncome(e.target.checked)}
            className="h-4 w-4 accent-emerald-600"
          />
          This is salary — counts toward "Deposits" on the dashboard
        </label>
      )}

      {error && <p className="text-xs font-medium text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-600 transition active:scale-95 dark:bg-zinc-800 dark:text-zinc-300"
        >
          Cancel
        </button>
      </div>
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
