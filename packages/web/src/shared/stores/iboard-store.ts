import { create } from 'zustand';
import { iboardApi, type IBoardStats, type TimelinePoint, type LeaderboardArticle, type SourceHealth } from '@shared/api/client';

interface IBoardState {
  stats: IBoardStats | null;
  timeline: TimelinePoint[];
  leaderboard: LeaderboardArticle[];
  sourcesHealth: SourceHealth[];
  isLoading: boolean;
  error: string | null;
}

interface IBoardActions {
  fetchStats: () => Promise<void>;
  fetchTimeline: () => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
  fetchSourcesHealth: () => Promise<void>;
  fetchAll: () => Promise<void>;
  clearError: () => void;
}

const initialState: IBoardState = {
  stats: null,
  timeline: [],
  leaderboard: [],
  sourcesHealth: [],
  isLoading: false,
  error: null,
};

export const useIBoardStore = create<IBoardState & IBoardActions>((set) => ({
  ...initialState,

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const stats = await iboardApi.stats();
      set({ stats, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки статистики',
        isLoading: false,
      });
    }
  },

  fetchTimeline: async () => {
    set({ isLoading: true, error: null });
    try {
      const timeline = await iboardApi.timeline();
      set({ timeline, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки таймлайна',
        isLoading: false,
      });
    }
  },

  fetchLeaderboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const leaderboard = await iboardApi.leaderboard();
      set({ leaderboard, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки лидерборда',
        isLoading: false,
      });
    }
  },

  fetchSourcesHealth: async () => {
    set({ isLoading: true, error: null });
    try {
      const sourcesHealth = await iboardApi.sourcesHealth();
      set({ sourcesHealth, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки health источников',
        isLoading: false,
      });
    }
  },

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const [stats, timeline, leaderboard, sourcesHealth] = await Promise.all([
        iboardApi.stats(),
        iboardApi.timeline(),
        iboardApi.leaderboard(),
        iboardApi.sourcesHealth(),
      ]);
      set({ stats, timeline, leaderboard, sourcesHealth, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки данных iBoard',
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
