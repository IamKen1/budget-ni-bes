"use client";

import { useRef } from "react";
import { createAccount } from "@/lib/actions/accounts";
import { useUndoToast } from "@/components/ToastContext";

export function AddAccountForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { showUndo } = useUndoToast();

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        const result = await createAccount(formData);
        if (result?.activityId) showUndo(result.activityId, "Account added");
        formRef.current?.reset();
      }}
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="text-sm font-semibold">Add Account</p>
      <input
        type="text"
        name="name"
        placeholder="Account name"
        required
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
      />
      <select
        name="type"
        required
        defaultValue="BANK"
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <option value="BANK">Bank</option>
        <option value="CASH">Cash</option>
        <option value="EWALLET">E-Wallet</option>
      </select>
      <button
        type="submit"
        className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900"
      >
        Add Account
      </button>
    </form>
  );
}
