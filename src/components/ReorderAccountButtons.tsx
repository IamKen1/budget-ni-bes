"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveAccount } from "@/lib/actions/accounts";

export function ReorderAccountButtons({
  accountId,
  isFirst,
  isLast,
}: {
  accountId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      await moveAccount(accountId, direction);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-shrink-0 flex-col">
      <button
        type="button"
        onClick={() => move("up")}
        disabled={isFirst || isPending}
        aria-label="Move up"
        className="flex h-5 w-6 items-center justify-center text-zinc-400 transition active:scale-90 disabled:opacity-20"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
          <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => move("down")}
        disabled={isLast || isPending}
        aria-label="Move down"
        className="flex h-5 w-6 items-center justify-center text-zinc-400 transition active:scale-90 disabled:opacity-20"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
