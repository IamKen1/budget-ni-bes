"use client";

import { formatMoney } from "@/lib/format";
import { useBalanceVisibility } from "@/components/BalanceVisibilityContext";

export function MaskableAmount({ value, className }: { value: number; className?: string }) {
  const { visible } = useBalanceVisibility();
  return <span className={className}>{visible ? formatMoney(value) : "₱ • • • • •"}</span>;
}
