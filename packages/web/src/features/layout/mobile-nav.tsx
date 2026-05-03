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
  Bell,
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
  { to: '/iboard', label: 'Аналитика', icon: BarChart3 },
  { to: '/subscription', label: 'Подписка', icon: Crown },
  { to: '/notifications', label: 'Уведомления', icon: Bell },
  { to: '/settings/profile', label: 'Настройки', icon: Settings },
];

export function MobileNav() {
  const location = useLocation();
  const { logout } = useAuthStore();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActiveRoute = (to: string) => {
    if (to === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(to);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md env-safe-bottom md:hidden">
      <div className="flex h-16 items-center justify-around px-1 relative">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActiveRoute(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors min-w-[56px]',
                isActive ? 'text-accent' : 'text-muted-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-[22px] w-[22px]',
                  isActive && 'stroke-[2.5]'
                )}
              />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}

        {/* Notification Bell (mobile) */}
        <div className="flex flex-col items-center justify-center min-w-[56px]">
          <NotificationBell />
        </div>

        {/* More button */}
        <button
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors min-w-[56px] relative',
            moreOpen ? 'text-accent' : 'text-muted-foreground'
          )}
          onClick={() => setMoreOpen(!moreOpen)}
        >
          <MoreHorizontal
            className={cn('h-[22px] w-[22px]', moreOpen && 'stroke-[2.5]')}
          />
          <span className="text-[10px] font-medium leading-none">Ещё</span>
        </button>

        {/* More menu dropdown */}
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-16 right-2 z-50 w-48 rounded-xl border border-border bg-card shadow-lg py-1">
              {moreMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to + (item.label || '')}
                    to={item.to}
                    search={item.search}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 text-sm transition-colors',
                      isActiveRoute(item.to)
                        ? 'text-accent bg-accent-light'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                    onClick={() => setMoreOpen(false)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { setMoreOpen(false); logout(); }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors"
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
