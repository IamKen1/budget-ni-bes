"use client";

import Link from "next/link";
import { MaskableAmount } from "@/components/MaskableAmount";
import { useBalanceVisibility } from "@/components/BalanceVisibilityContext";

export function CategoryBudgetCard({
  id,
  name,
  value,
  target,
}: {
  id: string;
  name: string;
  value: number;
  target: number;
}) {
  const { visible } = useBalanceVisibility();
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : value > 0 ? 100 : 0;
  const over = target > 0 && value > target;

  return (
    <Link
      href={`/transactions?categoryId=${id}`}
      className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{name}</p>
      <p className="mt-1 truncate text-base font-semibold">
        <MaskableAmount value={value} />
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-zinc-900 dark:bg-zinc-100"}`}
          style={{ width: `${visible ? pct : 0}%` }}
        />
      </div>
      <p className={`mt-1 truncate text-[11px] font-medium ${over ? "text-red-500" : "text-zinc-400"}`}>
        {target > 0 ? (
          over ? (
            <>
              <MaskableAmount value={Math.abs(target - value)} /> over
            </>
          ) : (
            <>
              <MaskableAmount value={target - value} /> left
            </>
          )
        ) : (
          "No target"
        )}
      </p>
    </Link>
  );
}
