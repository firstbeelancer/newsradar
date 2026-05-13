import { useEffect, useState } from 'react';
import { useNotificationsStore } from '@shared/stores/notifications-store';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Skeleton } from '@shared/ui/skeleton';
import { Badge } from '@shared/ui/badge';
import { cn } from '@shared/lib/utils';
import {
  Bell,
  CheckCheck,
  Info,
  Newspaper,
  Bot,
  Crown,
  AlertTriangle,
  Filter,
  Check,
} from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  system: { icon: Info, color: 'text-accent bg-accent-light', label: 'Система' },
  article: { icon: Newspaper, color: 'text-success bg-success-light', label: 'Статья' },
  agent: { icon: Bot, color: 'text-warning bg-warning-light', label: 'Агент' },
  subscription: { icon: Crown, color: 'text-warning bg-warning-light', label: 'Подписка' },
  error: { icon: AlertTriangle, color: 'text-danger bg-danger-light', label: 'Ошибка' },
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
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

type FilterType = 'all' | 'unread';

export function NotificationsPage() {
  const { notifications, isLoading, unreadCount, fetchNotifications, markRead, markAllRead } = useNotificationsStore();
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filtered = filter === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  const unreadByType = notifications.reduce<Record<string, number>>((acc, n) => {
    if (!n.is_read) {
      acc[n.type] = (acc[n.type] || 0) + 1;
    }
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Уведомления
          </h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Все уведомления прочитаны'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 mr-1.5" />
              Прочитать все
            </Button>
          )}
        </div>
      </div>

      {/* Stats by type */}
      {!isLoading && Object.keys(unreadByType).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(unreadByType).map(([type, count]) => {
            const config = TYPE_CONFIG[type] || TYPE_CONFIG.system;
            const Icon = config.icon;
            return (
              <div key={type} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', config.color)}>
                <Icon className="h-3 w-3" />
                {config.label}: {count}
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            filter === 'all' ? 'bg-accent text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          Все
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            filter === 'unread' ? 'bg-accent text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          Непрочитанные
          {unreadCount > 0 && ` (${unreadCount})`}
        </button>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3 py-2">
                  <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">
                {filter === 'unread' ? 'Нет непрочитанных уведомлений' : 'Нет уведомлений'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((notification) => {
                const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system;
                const Icon = config.icon;
                const isUnread = !notification.is_read;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/20',
                      isUnread && 'bg-accent-light/20'
                    )}
                  >
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0 mt-0.5', config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm', isUnread && 'font-medium')}>
                          {notification.title}
                        </p>
                        <span className="text-[11px] text-muted-foreground/60 shrink-0 mt-0.5">
                          {getRelativeTime(notification.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {isUnread ? (
                          <button
                            onClick={() => markRead(notification.id)}
                            className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover transition-colors"
                          >
                            <Check className="h-3 w-3" />
                            Отметить прочитанным
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
                            <Check className="h-3 w-3" />
                            Прочитано
                          </span>
                        )}
                      </div>
                    </div>
                    {isUnread && (
                      <div className="mt-3 h-2 w-2 rounded-full bg-accent shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
