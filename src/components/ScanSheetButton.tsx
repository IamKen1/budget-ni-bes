"use client";

import { useRef, useState, useTransition } from "react";
import { scanSheet, logScannedRow, type ScanResult, type ScanRow } from "@/lib/actions/scan-sheet";
import { formatMoney } from "@/lib/format";
import { useUndoToast } from "@/components/ToastContext";

export function ScanSheetButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loggedRows, setLoggedRows] = useState<Set<string>>(new Set());

  function handlePick() {
    inputRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setLoggedRows(new Set());
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const res = await scanSheet(formData);
      setResult(res);
    });
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={handlePick}
        disabled={isPending}
        className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition active:scale-[0.99] disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <p className="text-sm font-medium">{isPending ? "Scanning…" : "Scan Sheet"}</p>
          <p className="text-xs text-zinc-400">
            Upload JenKen Family.xlsx to check for changes vs. what's logged here
          </p>
        </div>
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-zinc-400">
          <path
            d="M4 4v16h16M8 15l3-3 3 3 4-5"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {result?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {result.error}
        </p>
      )}

      {result && !result.error && (
        <div className="flex flex-col gap-3">
          <p className="px-1 text-xs text-zinc-400">
            {result.totalRows} rows in sheet · {result.matched} already match · {result.missingFromApp?.length ?? 0}{" "}
            missing here · {result.extraInApp?.length ?? 0} not found in sheet
          </p>

          {result.missingFromApp && result.missingFromApp.length > 0 && (
            <ResultGroup
              title="In the sheet, not logged here"
              tone="amber"
              rows={result.missingFromApp}
              loggedRows={loggedRows}
              onLogged={(key) => setLoggedRows((prev) => new Set(prev).add(key))}
            />
          )}

          {result.extraInApp && result.extraInApp.length > 0 && (
            <ResultGroup title="Logged here, not found in the sheet" tone="zinc" rows={result.extraInApp} />
          )}

          {result.missingFromApp?.length === 0 && result.extraInApp?.length === 0 && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              Everything matches — no differences found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function rowKey(r: ScanRow, i: number) {
  return r.id ?? `${r.row}-${i}`;
}

function ResultGroup({
  title,
  tone,
  rows,
  loggedRows,
  onLogged,
}: {
  title: string;
  tone: "amber" | "zinc";
  rows: ScanRow[];
  loggedRows?: Set<string>;
  onLogged?: (key: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p
        className={`px-1 pb-2 text-xs font-semibold ${
          tone === "amber" ? "text-amber-600 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {title} ({rows.length})
      </p>
      <div className="flex flex-col gap-1">
        {rows.map((r, i) => (
          <ScanRowItem key={rowKey(r, i)} rowKey={rowKey(r, i)} row={r} logged={loggedRows?.has(rowKey(r, i))} onLogged={onLogged} />
        ))}
      </div>
    </div>
  );
}

function ScanRowItem({
  rowKey,
  row,
  logged,
  onLogged,
}: {
  rowKey: string;
  row: ScanRow;
  logged?: boolean;
  onLogged?: (key: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { showUndo } = useUndoToast();
  const canLog = !!onLogged;

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-xs">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {row.date} · {row.account} · {row.entryType.toLowerCase().replace("_", " ")}
          {row.category ? ` · ${row.category}` : ""}
        </p>
        {row.note && <p className="truncate text-zinc-400">{row.note}</p>}
        {error && <p className="text-red-500">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-semibold">{formatMoney(row.amount)}</span>
        {canLog &&
          (logged ? (
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Logged</span>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const res = await logScannedRow(row);
                  if (res.error) setError(res.error);
                  else {
                    onLogged?.(rowKey);
                    if (res.activityId) showUndo(res.activityId, "Logged from sheet");
                  }
                });
              }}
              className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition active:scale-95 disabled:opacity-50"
            >
              {isPending ? "…" : "Log this"}
            </button>
          ))}
      </div>
    </div>
  );
}
