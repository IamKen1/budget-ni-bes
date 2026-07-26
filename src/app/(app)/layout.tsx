import { BottomNav } from "@/components/BottomNav";
import { ChatWidget } from "@/components/ChatWidget";
import { ChatProvider } from "@/components/ChatContext";
import { ToastProvider } from "@/components/ToastContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ChatProvider>
        <div className="flex min-h-dvh flex-col lg:h-dvh">
          <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)] lg:max-w-none lg:overflow-y-auto lg:px-0 lg:pt-0 lg:pb-0">
            {children}
          </main>
          <ChatWidget />
          <div className="lg:hidden">
            <BottomNav />
          </div>
        </div>
      </ChatProvider>
    </ToastProvider>
  );
}
