import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '@shared/lib/utils';
import { Outlet } from '@tanstack/react-router';
import {
  User,
  Bot,
  FileText,
  Cpu,
  BarChart3,
} from 'lucide-react';

const settingsNav = [
  { to: '/settings/profile', label: 'Профиль', icon: User },
  { to: '/settings/agents', label: 'Агенты', icon: Bot },
  { to: '/settings/templates', label: 'Шаблоны', icon: FileText },
  { to: '/settings/ai-providers', label: 'AI провайдеры', icon: Cpu },
  { to: '/settings/scoring', label: 'Скоринг', icon: BarChart3 },
];

export function SettingsLayout() {
  const location = useLocation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="text-muted-foreground mt-1">Управление приложением</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <nav className="lg:w-56 shrink-0">
          <ul className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {settingsNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;

              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
