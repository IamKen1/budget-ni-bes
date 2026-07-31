import Link from "next/link";
import { getRecentActivity } from "@/lib/actions/activity";
import { ActivityRow } from "@/components/ActivityRow";
import { ClearDataForm } from "@/components/ClearDataForm";
import { ScanSheetButton } from "@/components/ScanSheetButton";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const activity = await getRecentActivity(page, 5);

  return (
    <div className="flex flex-col gap-5 pb-4 lg:mx-auto lg:max-w-lg lg:px-4 lg:pt-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          App preferences and safety tools
        </p>
      </header>

      <section>
        <h2 className="px-1 pb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Recent Actions
        </h2>
        <p className="px-1 pb-2 text-xs text-zinc-400">
          Made a mistake — wrong amount, wrong category, deleted the wrong entry? Undo it here.
        </p>
        <div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {activity.items.map((a) => (
            <ActivityRow key={a.id} id={a.id} summary={a.summary} when={a.when} undone={a.undone} />
          ))}
          {activity.items.length === 0 && (
            <p className="p-3 text-sm text-zinc-400">No recent actions yet.</p>
          )}
        </div>
        {activity.totalPages > 1 && (
          <div className="mt-2 flex items-center justify-center gap-4">
            <Link
              href={`/settings?page=${activity.page - 1}`}
              aria-disabled={activity.page <= 1}
              className={`text-sm font-medium ${
                activity.page <= 1
                  ? "pointer-events-none text-zinc-300 dark:text-zinc-700"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              Previous
            </Link>
            <span className="text-xs text-zinc-400">
              Page {activity.page} of {activity.totalPages}
            </span>
            <Link
              href={`/settings?page=${activity.page + 1}`}
              aria-disabled={activity.page >= activity.totalPages}
              className={`text-sm font-medium ${
                activity.page >= activity.totalPages
                  ? "pointer-events-none text-zinc-300 dark:text-zinc-700"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              Next
            </Link>
          </div>
        )}
      </section>

      <section>
        <h2 className="px-1 pb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Resync from Sheet
        </h2>
        <p className="px-1 pb-2 text-xs text-zinc-400">
          Check your JenKen Family.xlsx against what's logged here — shows what's different, doesn't change anything automatically.
        </p>
        <ScanSheetButton />
      </section>

      <section>
        <h2 className="px-1 pb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Export
        </h2>
        <a
          href="/api/export"
          className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div>
            <p className="text-sm font-medium">Download as Excel</p>
            <p className="text-xs text-zinc-400">All transactions, accounts, budget, and savings funds — .xlsx</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 flex-shrink-0 text-zinc-400">
            <path
              d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </section>

      <section>
        <h2 className="px-1 pb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Danger Zone
        </h2>
        <ClearDataForm />
      </section>
    </div>
  );
}
