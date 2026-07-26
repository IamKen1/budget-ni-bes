"use client";

import { useBalanceVisibility } from "@/components/BalanceVisibilityContext";

export function BalanceVisibilityToggle({ className }: { className?: string }) {
  const { visible, toggle } = useBalanceVisibility();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={visible ? "Hide balances" : "Show balances"}
      className={className ?? "flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-90"}
    >
      {visible ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path
            d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.8} />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path
            d="M3 3l18 18M10.6 10.6a2.5 2.5 0 0 0 3.5 3.5M6.6 6.7C4 8.3 2 12 2 12s3.5 7 10 7c2 0 3.6-.6 5-1.4M9.9 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-2.3 3.2"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
