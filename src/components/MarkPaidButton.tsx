"use client";

import { useEffect, useState, useTransition } from "react";
import { toggleLoanPaymentPaid } from "@/lib/actions/loans";

/** Marks an upcoming payment as paid — which posts a real expense transaction — so it asks for a
 * second tap first ("Confirm?") instead of acting on a single accidental touch. Unmarking is on /loans. */
export function MarkPaidButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Drop back to the idle state if the second tap never comes.
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirming) {
          setConfirming(true);
          return;
        }
        startTransition(async () => {
          await toggleLoanPaymentPaid(id);
          setConfirming(false);
        });
      }}
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition active:scale-95 disabled:opacity-60 ${
        confirming ? "bg-amber-600" : "bg-emerald-600"
      }`}
    >
      {isPending ? "Saving…" : confirming ? "Confirm?" : "Mark paid"}
    </button>
  );
}
