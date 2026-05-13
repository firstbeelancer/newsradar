import { useEffect, useState, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { Badge } from '@shared/ui/badge';
import { useNotificationsStore } from '@shared/stores/notifications-store';
import { Bell } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { NotificationDropdown } from './notification-dropdown';

export function NotificationBell() {
  const { unreadCount, fetchNotifications } = useNotificationsStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    // Poll every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
          open
            ? 'bg-accent-light text-accent'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
        aria-label="Уведомления"
      >
        <Bell className={cn('h-[18px] w-[18px]', open && 'stroke-[2.5]')} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && <NotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}
