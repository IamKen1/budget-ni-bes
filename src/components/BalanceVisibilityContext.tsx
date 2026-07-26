"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "budgetnibes:balances-visible";

const BalanceVisibilityContext = createContext<{
  visible: boolean;
  toggle: () => void;
} | null>(null);

export function BalanceVisibilityProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // localStorage isn't available during SSR, so the stored preference can only
    // be read (and synced into state) after mount — no non-effect alternative here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem(STORAGE_KEY) === "hidden") setVisible(false);
  }, []);

  const toggle = () => {
    setVisible((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "visible" : "hidden");
      return next;
    });
  };

  return (
    <BalanceVisibilityContext.Provider value={{ visible, toggle }}>
      {children}
    </BalanceVisibilityContext.Provider>
  );
}

export function useBalanceVisibility() {
  const ctx = useContext(BalanceVisibilityContext);
  if (!ctx) throw new Error("useBalanceVisibility must be used within BalanceVisibilityProvider");
  return ctx;
}
