import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '@shared/lib/utils';
import { NEWSRADAR_ICON_SRC } from '@shared/brand/newsradar-icon';
import { useAuthStore } from '@shared/stores/auth-store';
import { Avatar, AvatarFallback } from '@shared/ui/avatar';
import { Separator } from '@shared/ui/separator';
import { NotificationBell } from '@/features/notifications/notification-bell';
import {
  LayoutDashboard,
  Bot,
  Newspaper,
  Sparkles,
  Bookmark,
  Settings,
  LogOut,
  Crown,
  BarChart3,
  History,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Главная', icon: LayoutDashboard },
  { to: '/agents', label: 'Агенты', icon: Bot },
  { to: '/feed', label: 'Лента', icon: Newspaper },
  { to: '/generation', label: 'Генерация', icon: Sparkles },
  { to: '/history', label: 'История', icon: History },
  { to: '/feed', label: 'Избранное', icon: Bookmark, search: { favorites: '1' } },
  { to: '/iboard', label: 'Аналитика', icon: BarChart3 },
  { to: '/subscription', label: 'Подписка', icon: Crown },
  { to: '/settings/profile', label: 'Настройки', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isActiveRoute = (item: typeof navItems[0]) => {
    if (item.to === '/') return location.pathname === '/';
    if (item.to === '/feed' && item.search) return location.pathname === '/feed' && location.search?.favorites === '1';
    return location.pathname.startsWith(item.to);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-[100dvh] w-64 flex-col border-r border-hairline bg-white/86 backdrop-blur-2xl">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl nr-glow-hover">
            <img src={NEWSRADAR_ICON_SRC} alt="Newsradar" className="relative h-full w-full object-contain nr-icon-orb" />
          </div>
          <div className="leading-none">
            <span className="nr-iris-text block font-display text-[19px] font-extrabold tracking-[-0.04em]">
              Newsradar
            </span>
            <span className="mt-1 block text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-400">
              AI news studio
            </span>
          </div>
        </div>
        <NotificationBell />
      </div>

      <Separator className="bg-hairline" />

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item);

            return (
              <li key={item.label}>
                <Link
                  to={item.to}
                  search={item.search}
                  className={cn(
                    'group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-all duration-200',
                    isActive
                      ? 'bg-ink-900 text-white shadow-[var(--shadow-sm)]'
                      : 'text-ink-500 hover:bg-muted hover:text-ink-900'
                  )}
                >
                  {/* Brass rule marks the active route — quieter and more precise than a full gradient fill. */}
                  {isActive && (
                    <span className="nr-iris-mark absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
                  )}
                  <Icon
                    className={cn(
                      'h-[17px] w-[17px] transition-colors',
                      isActive ? 'text-white' : 'text-ink-400 group-hover:text-ink-700'
                    )}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Separator className="bg-hairline" />

      <div className="p-3">
        <div className="flex items-center gap-3 rounded-xl border border-hairline bg-muted/60 px-3 py-2.5">
          <Avatar className="h-9 w-9 ring-1 ring-hairline">
            {user?.avatar ? <img src={user.avatar} alt={user?.name || ''} /> : null}
            <AvatarFallback className="bg-accent-light text-accent text-xs font-bold">
              {user?.name ? getInitials(user.name) : '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink-900">{user?.name || 'Пользователь'}</p>
            <p className="truncate text-[11px] text-ink-400">{user?.email || ''}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-danger-light hover:text-danger" title="Выйти">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
