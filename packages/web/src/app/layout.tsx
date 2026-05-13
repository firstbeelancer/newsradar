import { Outlet } from '@tanstack/react-router';

export function RootLayout() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <Outlet />
    </div>
  );
}
