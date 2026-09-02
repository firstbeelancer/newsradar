import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { StatusBar } from './status-bar';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Atmosphere (gradient mesh + paper grain) lives in index.css so it sits behind
 * every route, rather than three blurred colour blobs stacked in the shell.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <main className="relative min-h-[100dvh] overflow-x-hidden pb-28 md:ml-64 md:pb-20">
        <div className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-6 md:px-8 lg:px-10 lg:py-9">
          {children}
        </div>
      </main>

      <MobileNav />
      <StatusBar />
    </div>
  );
}
