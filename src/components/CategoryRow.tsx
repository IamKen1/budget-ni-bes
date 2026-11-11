"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { useBalanceVisibility } from "@/components/BalanceVisibilityContext";
import { EditCategoryTargets } from "@/components/EditCategoryTargets";
import { ArchiveToggleButton } from "@/components/ArchiveToggleButton";
import { toggleArchiveCategory } from "@/lib/actions/categories";

export type CategoryStatus = "over" | "warn" | "ok" | "none" | "done";

type Props = {
  id: string;
  name: string;
  kind: "EXPENSE" | "SAVINGS";
  status: CategoryStatus;
  /** Main bar: spent vs period target (expense) or saved vs goal/period target (savings). */
  value: number;
  target: number;
  /** Right-side secondary text, e.g. "+₱500 this cutoff" for savings funds (amount is masked when balances are hidden). */
  note?: { amount: number; label: string; warn?: boolean };
  /** Appended to the status text, e.g. "spending fast" or "committed". */
  hint?: string;
  /** 0–1: how far into the period we are — drawn as a tick so you can see if spending is ahead of pace. */
  pace?: number;
  archived: boolean;
  monthlyTarget: number;
  goalTarget: number;
  firstHalfTarget?: number;
  isCommittedSpend?: boolean;
};

const BAR: Record<CategoryStatus, string> = {
  over: "bg-red-500",
  warn: "bg-amber-500",
  ok: "bg-zinc-900 dark:bg-zinc-100",
  none: "bg-zinc-300 dark:bg-zinc-700",
  done: "bg-emerald-600",
};

const TEXT: Record<CategoryStatus, string> = {
  over: "text-red-500",
  warn: "text-amber-600 dark:text-amber-400",
  ok: "text-zinc-500 dark:text-zinc-400",
  none: "text-zinc-400",
  done: "text-emerald-600 dark:text-emerald-400",
};

export function CategoryRow(props: Props) {
  const { id, name, kind, status, value, target, note, hint, pace } = props;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const { visible } = useBalanceVisibility();
  const money = (n: number) => (visible ? formatMoney(n) : "₱ • • •");

  const isSavings = kind === "SAVINGS";
  const pct = target > 0 ? Math.round((value / target) * 100) : 0;
  const barPct = target > 0 ? Math.min(100, pct) : value > 0 ? 100 : 0;
  const remaining = target - value;
  const barColor = isSavings && status !== "none" ? "bg-emerald-600" : BAR[status];

  let statusText: string;
  if (target <= 0) statusText = "No target · tap to set";
  else if (isSavings) statusText = remaining <= 0 ? "Goal reached ✓" : `${money(remaining)} to go`;
  else if (remaining < 0) statusText = `${money(-remaining)} over`;
  else statusText = `${money(remaining)} left`;

  return (
    <li className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setEditing(false);
        }}
        aria-expanded={open}
        className="w-full px-4 py-3 text-left transition active:bg-zinc-50 dark:active:bg-zinc-800/50"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {money(value)}
            {target > 0 && (
              <span className="font-normal text-zinc-400"> / {money(target)}</span>
            )}
          </span>
        </div>

        <div className="relative mt-2 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${visible ? barPct : 0}%` }}
          />
          {pace !== undefined && target > 0 && !isSavings && (
            <div
              className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-zinc-400 dark:bg-zinc-500"
              style={{ left: `${Math.min(100, pace * 100)}%` }}
              title="Where spending should be by today"
            />
          )}
        </div>

        <div className="mt-1 flex items-center justify-between gap-3 text-[11px] font-medium">
          <span className={isSavings && status !== "none" ? TEXT.done : TEXT[status]}>
            {statusText}
            {hint && ` · ${hint}`}
          </span>
          <span className={`truncate ${note?.warn ? "text-amber-600 dark:text-amber-400" : "text-zinc-400"}`}>
            {note
              ? `${note.amount > 0 ? "+" : ""}${money(note.amount)} ${note.label}`
              : target > 0
              ? `${pct}%`
              : ""}
          </span>
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {editing ? (
            <EditCategoryTargets
              categoryId={id}
              monthlyTarget={props.monthlyTarget}
              goalTarget={props.goalTarget}
              firstHalfTarget={props.firstHalfTarget}
              isCommittedSpend={props.isCommittedSpend}
              showGoal={isSavings}
              onDone={() => setEditing(false)}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Edit target
              </button>
              <Link
                href={`/transactions?categoryId=${id}`}
                className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 transition active:scale-95 dark:bg-zinc-800 dark:text-zinc-300"
              >
                View transactions
              </Link>
              <div className="ml-auto">
                <ArchiveToggleButton
                  id={id}
                  archived={props.archived}
                  toggleAction={toggleArchiveCategory}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
