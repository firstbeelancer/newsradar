import { Link, Outlet, useLocation } from '@tanstack/react-router';
import { Bot, Cpu, FileText, MessageSquare, SmilePlus, User } from 'lucide-react';
import { cn } from '@shared/lib/utils';

const settingsNav = [
  { to: '/settings/profile', label: 'Профиль', icon: User },
  { to: '/settings/agents', label: 'Агенты', icon: Bot },
  { to: '/settings/templates', label: 'Шаблоны', icon: FileText },
  { to: '/settings/ai-providers', label: 'AI провайдеры', icon: Cpu },
  { to: '/settings/prompts', label: 'Промпты', icon: MessageSquare },
  { to: '/settings/telegram-assets', label: 'Emoji и стикеры', icon: SmilePlus },
];

export function SettingsLayout() {
  const location = useLocation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="mt-1 text-muted-foreground">Управление приложением и редакторским контуром</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="shrink-0 lg:w-64">
          <ul className="flex gap-1 overflow-x-auto pb-2 scrollbar-none lg:flex-col lg:pb-0">
            {settingsNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;

              return (
                <li key={item.to} className="shrink-0 lg:shrink">
                  <Link
                    to={item.to}
                    className={cn(
                      'flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
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

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
