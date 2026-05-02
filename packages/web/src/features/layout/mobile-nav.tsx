import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '@shared/lib/utils';
import {
  LayoutDashboard,
  Bot,
  Sparkles,
  Bookmark,
  Settings,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Главная', icon: LayoutDashboard },
  { to: '/agents', label: 'Агенты', icon: Bot },
  { to: '/generations', label: 'Генерации', icon: Sparkles },
  { to: '/bookmarks', label: 'Избранное', icon: Bookmark },
  { to: '/settings', label: 'Настройки', icon: Settings },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md env-safe-bottom md:hidden">
      <div className="flex h-16 items-center justify-around px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors min-w-[56px]',
                isActive
                  ? 'text-accent'
                  : 'text-muted-foreground'
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
      </div>
    </nav>
  );
}
