import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { StatusBar } from './status-bar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed left-64 top-0 h-80 w-80 rounded-full bg-cyan-300/12 blur-3xl" />
      <div className="pointer-events-none fixed bottom-12 right-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />

      <div className="hidden md:block">
        <Sidebar />
      </div>

      <main className="relative min-h-[100dvh] pb-20 md:ml-64 md:pb-14">
        <div className="mx-auto max-w-5xl p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>

      <MobileNav />
      <StatusBar />
    </div>
  );
}
