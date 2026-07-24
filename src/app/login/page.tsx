import { login } from "@/lib/actions/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { error, from } = await searchParams;

  return (
    <div
      className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 1.5rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-600 text-2xl font-semibold text-white shadow-lg shadow-emerald-600/20">
            ₱
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            BudgetNiBes
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Enter the family passcode to continue
          </p>
        </div>

        <form action={login} className="flex flex-col gap-4">
          <input type="hidden" name="from" value={from ?? "/"} />
          <input
            type="password"
            name="passcode"
            inputMode="text"
            autoComplete="current-password"
            autoFocus
            required
            placeholder="Passcode"
            className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-center text-lg tracking-widest text-zinc-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
          />

          {error && (
            <p className="text-center text-sm font-medium text-red-600 dark:text-red-400">
              Incorrect passcode. Try again.
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-semibold text-white shadow-sm shadow-emerald-600/20 transition active:scale-[0.98] active:bg-emerald-700"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
