import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '@shared/lib/utils';
import { useAuthStore } from '@shared/stores/auth-store';
import { Avatar, AvatarFallback } from '@shared/ui/avatar';
import { Separator } from '@shared/ui/separator';
import {
  LayoutDashboard,
  Bot,
  Newspaper,
  Sparkles,
  Bookmark,
  Settings,
  LogOut,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Главная', icon: LayoutDashboard },
  { to: '/agents', label: 'Агенты', icon: Bot },
  { to: '/feed', label: 'Лента', icon: Newspaper },
  { to: '/generation', label: 'Генерация', icon: Sparkles },
  { to: '/feed', label: 'Избранное', icon: Bookmark, search: { favorites: '1' } },
  { to: '/settings/profile', label: 'Настройки', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isActiveRoute = (item: typeof navItems[0]) => {
    if (item.to === '/') {
      return location.pathname === '/';
    }
    if (item.to === '/feed' && item.search) {
      return location.pathname === '/feed' && location.search?.includes('favorites');
    }
    return location.pathname.startsWith(item.to);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-[100dvh] w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
          <Newspaper className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-tight">Newsradar</span>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item);

            return (
              <li key={item.label}>
                <Link
                  to={item.to}
                  search={item.search}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent-light text-accent'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Separator />

      {/* User section */}
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <Avatar className="h-8 w-8">
            {user?.avatar ? (
              <img src={user.avatar} alt={user?.name || ''} />
            ) : null}
            <AvatarFallback className="bg-accent-light text-accent text-xs">
              {user?.name ? getInitials(user.name) : '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || 'Пользователь'}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger-light hover:text-danger"
            title="Выйти"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
