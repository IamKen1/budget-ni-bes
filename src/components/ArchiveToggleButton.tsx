"use client";

export function ArchiveToggleButton({
  archived,
  onToggle,
}: {
  archived: boolean;
  onToggle: () => Promise<void>;
}) {
  return (
    <form action={onToggle}>
      <button
        type="submit"
        className={`rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
          archived
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
        }`}
      >
        {archived ? "Restore" : "Archive"}
      </button>
    </form>
  );
}
