import { getRecentActivity } from "@/lib/actions/activity";
import { ActivityRow } from "@/components/ActivityRow";
import { ClearDataForm } from "@/components/ClearDataForm";

export default async function SettingsPage() {
  const activity = await getRecentActivity(20);

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
          {activity.map((a) => (
            <ActivityRow key={a.id} id={a.id} summary={a.summary} when={a.when} undone={a.undone} />
          ))}
          {activity.length === 0 && (
            <p className="p-3 text-sm text-zinc-400">No recent actions yet.</p>
          )}
        </div>
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
