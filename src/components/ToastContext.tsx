"use client";

import { createContext, useCallback, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { undoActivity } from "@/lib/actions/activity";

type Toast = { activityId: string; message: string } | null;

const ToastContext = createContext<{
  showUndo: (activityId: string, message: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showUndo = useCallback((activityId: string, message: string) => {
    setError(null);
    setToast({ activityId, message });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setToast((t) => (t?.activityId === activityId ? null : t));
    }, 6000);
  }, []);

  return (
    <ToastContext.Provider value={{ showUndo }}>
      {children}
      {toast && (
        <div
          className="fixed inset-x-4 z-50 flex justify-center"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
        >
          <div className="flex items-center gap-3 rounded-full bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
            <span>{error ?? (isPending ? "Undoing…" : toast.message)}</span>
            {!isPending && !error && (
              <button
                type="button"
                className="font-semibold text-emerald-400 dark:text-emerald-600"
                onClick={() => {
                  const activityId = toast.activityId;
                  startTransition(async () => {
                    const result = await undoActivity(activityId);
                    if (result.error) {
                      setError(result.error);
                      if (timeoutRef.current) clearTimeout(timeoutRef.current);
                      timeoutRef.current = setTimeout(() => setToast(null), 3000);
                    } else {
                      setToast(null);
                    }
                  });
                }}
              >
                Undo
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useUndoToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useUndoToast must be used within ToastProvider");
  return ctx;
}
