import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { StatusBar } from './status-bar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[18%] top-[-8%] h-[28rem] w-[28rem] rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute right-[-6%] top-[8%] h-[26rem] w-[26rem] rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[30%] h-[22rem] w-[22rem] rounded-full bg-indigo-400/10 blur-3xl" />
      </div>

      <div className="hidden md:block">
        <Sidebar />
      </div>

      <main className="relative min-h-[100dvh] overflow-x-hidden pb-24 md:ml-64 md:pb-16">
        <div className="mx-auto max-w-6xl p-3 sm:p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>

      <MobileNav />
      <StatusBar />
    </div>
  );
}
