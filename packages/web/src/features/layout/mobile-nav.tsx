import { useState } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '@shared/lib/utils';
import {
  LayoutDashboard,
  Bot,
  Newspaper,
  Sparkles,
  MoreHorizontal,
  Settings,
  Bookmark,
  LogOut,
  Crown,
  BarChart3,
  History,
} from 'lucide-react';
import { useAuthStore } from '@shared/stores/auth-store';
import { NotificationBell } from '@/features/notifications/notification-bell';

const mainNavItems = [
  { to: '/', label: 'Главная', icon: LayoutDashboard },
  { to: '/agents', label: 'Агенты', icon: Bot },
  { to: '/feed', label: 'Лента', icon: Newspaper },
  { to: '/generation', label: 'Генерация', icon: Sparkles },
];

const moreMenuItems = [
  { to: '/feed', label: 'Избранное', icon: Bookmark, search: { favorites: '1' } as Record<string, string> },
  { to: '/history', label: 'История', icon: History },
  { to: '/iboard', label: 'Аналитика', icon: BarChart3 },
  { to: '/subscription', label: 'Подписка', icon: Crown },
  { to: '/settings/profile', label: 'Настройки', icon: Settings },
];

export function MobileNav() {
  const location = useLocation();
  const { logout } = useAuthStore();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActiveRoute = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-cyan-100/80 bg-white/82 shadow-[0_-18px_45px_rgba(0,39,126,0.10)] backdrop-blur-2xl env-safe-bottom md:hidden">
      <div className="relative flex h-16 items-center justify-around px-1">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActiveRoute(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1.5 transition-all',
                isActive ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-200' : 'text-muted-foreground hover:bg-white hover:text-slate-950 hover:shadow-md hover:shadow-cyan-100'
              )}
            >
              <Icon className={cn('h-[22px] w-[22px]', isActive && 'stroke-[2.5]')} />
              <span className="text-[10px] font-semibold leading-none">{item.label}</span>
            </Link>
          );
        })}

        <div className="flex min-w-[56px] flex-col items-center justify-center">
          <NotificationBell />
        </div>

        <button
          className={cn(
            'relative flex min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1.5 transition-all',
            moreOpen ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-200' : 'text-muted-foreground hover:bg-white hover:text-slate-950 hover:shadow-md hover:shadow-cyan-100'
          )}
          onClick={() => setMoreOpen(!moreOpen)}
        >
          <MoreHorizontal className={cn('h-[22px] w-[22px]', moreOpen && 'stroke-[2.5]')} />
          <span className="text-[10px] font-semibold leading-none">Ещё</span>
        </button>

        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-16 right-2 z-50 w-52 rounded-3xl border border-cyan-100 bg-white/92 py-1.5 shadow-2xl shadow-blue-950/15 backdrop-blur-2xl">
              {moreMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to + (item.label || '')}
                    to={item.to}
                    search={item.search}
                    className={cn(
                      'mx-1.5 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all',
                      isActiveRoute(item.to) ? 'bg-accent-light text-accent' : 'text-muted-foreground hover:bg-cyan-50 hover:text-slate-950'
                    )}
                    onClick={() => setMoreOpen(false)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <div className="my-1 border-t border-cyan-100" />
              <button
                onClick={() => { setMoreOpen(false); logout(); }}
                className="mx-1.5 flex w-[calc(100%-0.75rem)] items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger-light"
              >
                <LogOut className="h-4 w-4" />
                Выйти
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
