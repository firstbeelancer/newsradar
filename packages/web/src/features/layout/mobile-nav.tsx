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
  Bell,
} from 'lucide-react';
import { useAuthStore } from '@shared/stores/auth-store';

const mainNavItems = [
  { to: '/', label: 'Главная', icon: LayoutDashboard },
  { to: '/agents', label: 'Агенты', icon: Bot },
  { to: '/feed', label: 'Лента', icon: Newspaper },
  { to: '/generation', label: 'Генерация', icon: Sparkles },
  { to: '/history', label: 'История', icon: History },
];

const moreMenuItems = [
  { to: '/feed', label: 'Избранное', icon: Bookmark, search: { favorites: '1' } as Record<string, string> },
  { to: '/notifications', label: 'Уведомления', icon: Bell },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-hairline bg-white/90 shadow-[0_-8px_28px_rgba(10,22,40,0.07)] backdrop-blur-2xl env-safe-bottom md:hidden">
      <div className="relative flex h-16 items-center justify-around px-1">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActiveRoute(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'relative flex min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 transition-all duration-200',
                isActive ? 'text-accent' : 'text-ink-400 active:text-ink-700'
              )}
            >
              {/* An iridescent tick above the active tab, instead of a heavy filled pill. */}
              {isActive && (
                <span className="nr-iris-mark absolute -top-px h-[3px] w-7 rounded-b-full" />
              )}
              <Icon className={cn('h-[21px] w-[21px]', isActive && 'stroke-[2.4]')} />
              <span className={cn('text-[10px] leading-none', isActive ? 'font-bold' : 'font-semibold')}>
                {item.label}
              </span>
            </Link>
          );
        })}

        <button
          className={cn(
            'relative flex min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 transition-all duration-200',
            moreOpen ? 'text-accent' : 'text-ink-400 active:text-ink-700'
          )}
          onClick={() => setMoreOpen(!moreOpen)}
        >
          {moreOpen && <span className="nr-iris-mark absolute -top-px h-[3px] w-7 rounded-b-full" />}
          <MoreHorizontal className={cn('h-[21px] w-[21px]', moreOpen && 'stroke-[2.4]')} />
          <span className={cn('text-[10px] leading-none', moreOpen ? 'font-bold' : 'font-semibold')}>Ещё</span>
        </button>

        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div className="nr-dropdown-glow absolute bottom-16 right-2 z-50 w-52 rounded-2xl border border-hairline bg-white/95 py-1.5 backdrop-blur-2xl">
              {moreMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to + (item.label || '')}
                    to={item.to}
                    search={item.search}
                    className={cn(
                      'mx-1.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-all',
                      isActiveRoute(item.to) ? 'bg-accent-light text-accent' : 'text-ink-500 hover:bg-muted hover:text-ink-900'
                    )}
                    onClick={() => setMoreOpen(false)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <div className="my-1 border-t border-hairline" />
              <button
                onClick={() => { setMoreOpen(false); logout(); }}
                className="mx-1.5 flex w-[calc(100%-0.75rem)] items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-danger transition-colors hover:bg-danger-light"
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
