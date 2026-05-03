import { create } from 'zustand';
import { notificationsApi, type Notification } from '@shared/api/client';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isMarkingRead: boolean;
  error: string | null;
}

interface NotificationsActions {
  fetchNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearError: () => void;
}

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isMarkingRead: false,
  error: null,
};

export const useNotificationsStore = create<NotificationsState & NotificationsActions>((set, get) => ({
  ...initialState,

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const notifications = await notificationsApi.list();
      const unreadCount = notifications.filter((n) => !n.is_read).length;
      set({ notifications, unreadCount, isLoading: false });
    } catch (err) {
      set({
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Ошибка загрузки уведомлений',
      });
    }
  },

  markRead: async (id) => {
    set({ isMarkingRead: true, error: null });
    try {
      await notificationsApi.markRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
        isMarkingRead: false,
      }));
    } catch (err) {
      set({
        isMarkingRead: false,
        error: err instanceof Error ? err.message : 'Ошибка отметки прочтения',
      });
    }
  },

  markAllRead: async () => {
    set({ isMarkingRead: true, error: null });
    try {
      await notificationsApi.markAllRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
        isMarkingRead: false,
      }));
    } catch (err) {
      set({
        isMarkingRead: false,
        error: err instanceof Error ? err.message : 'Ошибка отметки прочтения',
      });
    }
  },

  clearError: () => set({ error: null }),
}));
