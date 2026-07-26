"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendChatMessage, type ChatMessage } from "@/lib/actions/chat";
import { useChat } from "@/components/ChatContext";

export function ChatWidget() {
  const { open, setOpen } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function send() {
    const text = input.trim();
    if (!text || isPending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    startTransition(async () => {
      const reply = await sendChatMessage(next);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30 lg:inset-auto lg:bottom-6 lg:right-6 lg:justify-start lg:bg-transparent"
      onClick={() => setOpen(false)}
    >
      <div
        className="flex h-[85dvh] flex-col rounded-t-3xl bg-white shadow-xl dark:bg-zinc-950 lg:h-128 lg:w-96 lg:rounded-3xl lg:border lg:border-zinc-200 lg:dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-900">
          <p className="text-sm font-semibold">Bes AI</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 dark:bg-zinc-900 dark:text-zinc-400"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-zinc-400">
              <p>Hi! Ask me things like:</p>
              <p className="italic">&ldquo;How much did we spend today?&rdquo;</p>
              <p className="italic">&ldquo;Log expense: 150 grocery, cash&rdquo;</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-emerald-600 text-white"
                    : "mr-auto bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                }`}
              >
                {m.content}
              </div>
            ))}
            {isPending && (
              <div className="mr-auto flex items-center gap-1 rounded-2xl bg-zinc-100 px-3.5 py-2.5 dark:bg-zinc-900">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-zinc-100 px-3 py-3 dark:border-zinc-900">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Message Bes AI..."
            className="flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={send}
            disabled={isPending || !input.trim()}
            aria-label="Send"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition active:scale-95 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
