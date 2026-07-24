"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const ChatContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <ChatContext.Provider value={{ open, setOpen }}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
