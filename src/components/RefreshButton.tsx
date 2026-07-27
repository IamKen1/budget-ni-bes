"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshAppData } from "@/lib/actions/refresh";

export function RefreshButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (isPending) return;
    startTransition(async () => {
      await refreshAppData();
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label="Refresh data"
      className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 disabled:opacity-40 dark:bg-zinc-900 dark:text-zinc-400"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={`h-5 w-5 ${isPending ? "animate-spin" : ""}`}
      >
        <path
          d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
