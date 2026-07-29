"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useChat } from "@/components/ChatContext";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path
        d="M4 11.5 12 4l8 7.5M6 9.5V19a1 1 0 0 0 1 1h3v-5a2 2 0 1 1 4 0v5h3a1 1 0 0 0 1-1V9.5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path
        d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WalletIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1H5.5A2.5 2.5 0 0 1 3 5.5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 7.5V18a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5.5A2.5 2.5 0 0 1 3 7.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
      />
      <circle cx="17" cy="14" r="1.2" fill="currentColor" />
    </svg>
  );
}

function TagIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path
        d="m12 3 7.5 7.5a2 2 0 0 1 0 2.83l-6.17 6.17a2 2 0 0 1-2.83 0L3 12V4a1 1 0 0 1 1-1h8Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <rect
        x="4"
        y="5.5"
        width="16"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <path d="M4 10h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
      <path d="M8.5 14h1.5M8.5 17h1.5M12.25 14h1.5M12.25 17h1.5M16 14h1.5" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

const leftItems: { href: string; label: string; icon: (active: boolean) => ReactNode }[] = [
  { href: "/", label: "Home", icon: (a) => <HomeIcon active={a} /> },
  { href: "/transactions", label: "History", icon: (a) => <ListIcon active={a} /> },
  { href: "/accounts", label: "Accounts", icon: (a) => <WalletIcon active={a} /> },
];

const rightItems: { href: string; label: string; icon: (active: boolean) => ReactNode }[] = [
  { href: "/categories", label: "Categories", icon: (a) => <TagIcon active={a} /> },
  { href: "/loans", label: "Loans", icon: (a) => <CalendarIcon active={a} /> },
];

export function BottomNav() {
  const pathname = usePathname();
  const { open, setOpen } = useChat();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/80 bg-white/90 backdrop-blur-lg dark:border-zinc-800/80 dark:bg-zinc-950/90"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative mx-auto flex max-w-lg items-stretch justify-between px-2">
        {leftItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        <div className="flex w-16 flex-shrink-0 items-center justify-center">
          <Link
            href="/transactions/new"
            aria-label="Add transaction"
            className="-translate-y-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition active:scale-95"
          >
            <PlusIcon />
          </Link>
        </div>

        {rightItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="Open Bes AI chat"
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition active:scale-95 ${
            open ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          <ChatIcon active={open} />
          Bes AI
        </button>
      </div>
    </nav>
  );
}

function NavLink({
  item,
  pathname,
}: {
  item: { href: string; label: string; icon: (active: boolean) => ReactNode };
  pathname: string;
}) {
  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition active:scale-95 ${
        active
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-zinc-400 dark:text-zinc-500"
      }`}
    >
      {item.icon(active)}
      {item.label}
    </Link>
  );
}
