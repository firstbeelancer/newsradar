import { Link } from '@tanstack/react-router';
import { useNotificationsStore } from '@shared/stores/notifications-store';
import { Button } from '@shared/ui/button';
import { Skeleton } from '@shared/ui/skeleton';
import { cn } from '@shared/lib/utils';
import {
  Bell,
  CheckCheck,
  Info,
  Newspaper,
  Bot,
  Crown,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  system: { icon: Info, color: 'text-accent bg-accent-light' },
  article: { icon: Newspaper, color: 'text-success bg-success-light' },
  agent: { icon: Bot, color: 'text-warning bg-warning-light' },
  subscription: { icon: Crown, color: 'text-warning bg-warning-light' },
  error: { icon: AlertTriangle, color: 'text-danger bg-danger-light' },
};

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'только что';
  if (diffMin < 60) return `${diffMin} мин. назад`;
  if (diffHour < 24) return `${diffHour} ч. назад`;
  if (diffDay < 30) return `${diffDay} д. назад`;
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { notifications, isLoading, unreadCount, markRead, markAllRead } = useNotificationsStore();

  const handleMarkRead = (id: string) => {
    markRead(id);
  };

  const handleMarkAllRead = () => {
    markAllRead();
  };

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Уведомления</span>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Прочитать все
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Нет уведомлений</p>
          </div>
        ) : (
          notifications.slice(0, 20).map((notification) => {
            const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system;
            const Icon = config.icon;
            const isUnread = !notification.is_read;

            return (
              <div
                key={notification.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer',
                  isUnread && 'bg-accent-light/30'
                )}
                onClick={() => handleMarkRead(notification.id)}
              >
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5', config.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm leading-snug', isUnread && 'font-medium')}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {notification.message}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    {getRelativeTime(notification.created_at)}
                  </p>
                </div>
                {isUnread && (
                  <div className="mt-2 h-2 w-2 rounded-full bg-accent shrink-0" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t border-border px-4 py-2">
          <Link
            to="/notifications"
            className="flex items-center justify-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors py-1"
            onClick={onClose}
          >
            Все уведомления
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
