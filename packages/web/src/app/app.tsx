import { Outlet } from '@tanstack/react-router';
import { AppShell } from '@/features/layout/app-shell';

export function App() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
