import dayjs from "dayjs";
import type { CategoryProgress, DateRange } from "@/lib/queries";
import type { CategoryStatus } from "@/components/CategoryRow";

/** Share of the budget used at which a category is flagged "near limit". */
export const WARN_RATIO = 0.85;

/** How far into the period we are (0–1) and how many calendar days remain, today included. */
export function periodProgress(period: DateRange, now = dayjs()) {
  const start = dayjs(period.start);
  const end = dayjs(period.end);
  const pace = Math.min(1, Math.max(0, now.diff(start) / end.diff(start)));
  const daysLeft = Math.max(0, end.startOf("day").diff(now.startOf("day"), "day") + 1);
  return { pace, daysLeft };
}

export function expenseStatus(c: CategoryProgress, pace: number): { status: CategoryStatus; ahead: boolean } {
  if (c.periodTarget <= 0) return { status: "none", ahead: false };
  const ratio = c.periodTotal / c.periodTarget;
  // "Ahead of pace": already used noticeably more of the budget than the share of the
  // period that has passed (only meaningful once a decent chunk is spent).
  const ahead = ratio >= 0.5 && ratio > pace + 0.1;
  if (ratio > 1) return { status: "over", ahead };
  if (ratio >= WARN_RATIO || ahead) return { status: "warn", ahead };
  return { status: "ok", ahead };
}

export type RankedExpense = CategoryProgress & { status: CategoryStatus; ahead: boolean };

/** Expense categories split into "needs attention" (over first, then warn — worst ratio first)
 * and "on track" (ok in original order, then no-target ones last). */
export function rankExpenses(categories: CategoryProgress[], pace: number) {
  const ranked: RankedExpense[] = categories.map((c) => ({ ...c, ...expenseStatus(c, pace) }));
  const ratio = (c: CategoryProgress) => c.periodTotal / c.periodTarget;
  const attention = ranked
    .filter((c) => c.status === "over" || c.status === "warn")
    .sort((a, b) => (a.status === b.status ? ratio(b) - ratio(a) : a.status === "over" ? -1 : 1));
  const onTrack = [...ranked.filter((c) => c.status === "ok"), ...ranked.filter((c) => c.status === "none")];
  return { ranked, attention, onTrack };
}

export function expenseHint(c: RankedExpense): string | undefined {
  if (c.status === "warn" && c.ahead) return "spending fast";
  if (c.isCommittedSpend) return "committed";
  return undefined;
}
