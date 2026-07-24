import { BottomNav } from "@/components/BottomNav";
import { ChatWidget } from "@/components/ChatWidget";
import { ChatProvider } from "@/components/ChatContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <div className="flex min-h-dvh flex-col">
        <main
          className="mx-auto w-full max-w-lg flex-1 px-4"
          style={{
            paddingTop: "max(env(safe-area-inset-top), 1rem)",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)",
          }}
        >
          {children}
        </main>
        <ChatWidget />
        <BottomNav />
      </div>
    </ChatProvider>
  );
}
