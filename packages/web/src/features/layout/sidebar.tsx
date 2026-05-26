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
    <aside className="fixed left-0 top-0 z-40 flex h-[100dvh] w-64 flex-col border-r border-cyan-100/70 bg-white/75 shadow-2xl shadow-blue-950/5 backdrop-blur-2xl">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl nr-glow-hover">
            <span className="absolute inset-1 rounded-2xl bg-cyan-300/20 blur-md" />
            <img src={NEWSRADAR_ICON_SRC} alt="Newsradar" className="relative h-full w-full object-contain nr-icon-orb" />
          </div>
          <div>
            <span className="block text-lg font-black tracking-tight text-slate-950">Newsradar</span>
            <span className="block text-[11px] font-medium text-cyan-700">AI news radar</span>
          </div>
        </div>
        <NotificationBell />
      </div>

      <Separator className="bg-cyan-100/80" />

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item);

            return (
              <li key={item.label}>
                <Link
                  to={item.to}
                  search={item.search}
                  className={cn(
                    'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all',
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-200/70'
                      : 'text-slate-500 hover:-translate-y-0.5 hover:bg-white hover:text-slate-950 hover:shadow-md hover:shadow-cyan-100/80'
                  )}
                >
                  <Icon className={cn('h-[18px] w-[18px] transition-transform group-hover:scale-110', isActive && 'drop-shadow')} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Separator className="bg-cyan-100/80" />

      <div className="p-3">
        <div className="flex items-center gap-3 rounded-2xl border border-cyan-100/70 bg-white/70 px-3 py-2.5 shadow-inner shadow-cyan-50">
          <Avatar className="h-9 w-9 ring-2 ring-cyan-100">
            {user?.avatar ? <img src={user.avatar} alt={user?.name || ''} /> : null}
            <AvatarFallback className="bg-accent-light text-accent text-xs font-bold">
              {user?.name ? getInitials(user.name) : '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{user?.name || 'Пользователь'}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
          </div>
          <button onClick={logout} className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-danger-light hover:text-danger" title="Выйти">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
