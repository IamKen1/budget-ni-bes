import { formatMoney } from "@/lib/format";

export function ProgressBar({
  label,
  value,
  target,
  tone = "zinc",
  showVariance = true,
  leftValue,
}: {
  label: string;
  value: number;
  target: number;
  tone?: "zinc" | "emerald";
  showVariance?: boolean;
  /** Override the "left"/"to go" amount shown below the bar. Defaults to target - value
   * (right for a spending budget). Pass the account balance itself for a "spending money"
   * bar, where value/target track deposits, not spend-vs-limit. */
  leftValue?: number;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : value > 0 ? 100 : 0;
  const variance = leftValue ?? target - value;
  const overBudget = tone === "zinc" && (leftValue !== undefined ? variance < 0 : target > 0 && value > target);

  const barColor = overBudget
    ? "bg-red-500"
    : tone === "emerald"
    ? "bg-emerald-600"
    : "bg-zinc-900 dark:bg-zinc-100";

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-zinc-400">
          {formatMoney(value)}
          {target > 0 ? ` / ${formatMoney(target)}` : ""}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showVariance && target > 0 && (
        <p
          className={`mt-1 text-[11px] font-medium ${
            overBudget
              ? "text-red-500"
              : tone === "emerald"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-zinc-400"
          }`}
        >
          {overBudget
            ? `${formatMoney(Math.abs(variance))} over`
            : tone === "emerald"
            ? `${formatMoney(variance)} to go`
            : `${formatMoney(variance)} left`}
        </p>
      )}
    </div>
  );
}
