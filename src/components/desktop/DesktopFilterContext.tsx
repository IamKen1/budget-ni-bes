"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type Filter = { type: "account" | "category"; id: string; label: string } | null;

const DesktopFilterContext = createContext<{
  filter: Filter;
  setFilter: (f: Filter) => void;
} | null>(null);

export function DesktopFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<Filter>(null);
  return (
    <DesktopFilterContext.Provider value={{ filter, setFilter }}>
      {children}
    </DesktopFilterContext.Provider>
  );
}

export function useDesktopFilter() {
  const ctx = useContext(DesktopFilterContext);
  if (!ctx) throw new Error("useDesktopFilter must be used within DesktopFilterProvider");
  return ctx;
}
