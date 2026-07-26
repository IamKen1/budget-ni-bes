"use client";

import { useTransition } from "react";
import { useUndoToast } from "@/components/ToastContext";

export function ArchiveToggleButton({
  id,
  archived,
  toggleAction,
}: {
  id: string;
  archived: boolean;
  toggleAction: (id: string, archived: boolean) => Promise<{ activityId?: string; error?: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const { showUndo } = useUndoToast();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await toggleAction(id, !archived);
          if (result?.activityId) {
            showUndo(result.activityId, archived ? "Restored" : "Archived");
          }
        });
      }}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
        archived
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {archived ? "Restore" : "Archive"}
    </button>
  );
}
