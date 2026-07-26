"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { SerializedTransaction } from "@/lib/queries";

const TransactionDetailContext = createContext<{
  transaction: SerializedTransaction | null;
  open: (tx: SerializedTransaction) => void;
  close: () => void;
} | null>(null);

export function TransactionDetailProvider({ children }: { children: ReactNode }) {
  const [transaction, setTransaction] = useState<SerializedTransaction | null>(null);
  return (
    <TransactionDetailContext.Provider
      value={{
        transaction,
        open: setTransaction,
        close: () => setTransaction(null),
      }}
    >
      {children}
    </TransactionDetailContext.Provider>
  );
}

export function useTransactionDetail() {
  const ctx = useContext(TransactionDetailContext);
  if (!ctx) throw new Error("useTransactionDetail must be used within TransactionDetailProvider");
  return ctx;
}
