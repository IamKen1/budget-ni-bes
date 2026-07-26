"use client";

import { useState, useTransition } from "react";
import { undoActivity } from "@/lib/actions/activity";

export function ActivityRow({
  id,
  summary,
  when,
  undone,
}: {
  id: string;
  summary: string;
  when: string;
  undone: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "undone" | "error">(undone ? "undone" : "idle");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5">
      <div className="min-w-0">
        <p className={`truncate text-sm font-medium ${state === "undone" ? "text-zinc-400 line-through" : ""}`}>
          {summary}
        </p>
        <p className="text-xs text-zinc-400">{when}{error ? ` · ${error}` : ""}</p>
      </div>
      {state === "idle" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const result = await undoActivity(id);
              if (result.error) setError(result.error);
              else setState("undone");
            });
          }}
          className="flex-shrink-0 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 transition active:scale-95 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {isPending ? "…" : "Undo"}
        </button>
      )}
      {state === "undone" && (
        <span className="flex-shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Undone
        </span>
      )}
    </div>
  );
}
