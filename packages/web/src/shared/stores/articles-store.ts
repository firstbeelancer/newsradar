import { create } from 'zustand';
import { articlesApi, type Article, type ArticleFilters } from '@shared/api/client';

interface ArticlesState {
  // Client state
  filters: ArticleFilters;
  searchQuery: string;
  selectedArticleIds: string[];
  currentArticle: Article | null;
  isLoading: boolean;
  error: string | null;
  // Track optimistic favorite state by article ID
  optimisticFavorites: Record<string, boolean>;
}

interface ArticlesActions {
  setFilters: (filters: Partial<ArticleFilters>) => void;
  setSearchQuery: (query: string) => void;
  toggleArticleSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
  fetchArticle: (id: string) => Promise<void>;
  toggleFavorite: (id: string, currentIsFavorite?: boolean) => Promise<void>;
  setCurrentArticle: (article: Article | null) => void;
  clearError: () => void;
}

const initialState: ArticlesState = {
  filters: {},
  searchQuery: '',
  selectedArticleIds: [],
  currentArticle: null,
  isLoading: false,
  error: null,
  optimisticFavorites: {},
};

export const useArticlesStore = create<ArticlesState & ArticlesActions>((set, get) => ({
  ...initialState,

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleArticleSelection: (id) =>
    set((state) => ({
      selectedArticleIds: state.selectedArticleIds.includes(id)
        ? state.selectedArticleIds.filter((sid) => sid !== id)
        : [...state.selectedArticleIds, id],
    })),

  clearSelection: () => set({ selectedArticleIds: [] }),

  selectAll: (ids) => set({ selectedArticleIds: ids }),

  fetchArticle: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const article = await articlesApi.get(id);
      set({ currentArticle: article, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки статьи',
        isLoading: false,
      });
    }
  },

  toggleFavorite: async (id, currentIsFavorite) => {
    // Determine current state: prefer explicitly passed value, then optimistic, then store
    const state = get();
    const wasFavorite: boolean = currentIsFavorite
      ?? state.optimisticFavorites[id]
      ?? (state.currentArticle?.id === id ? !!state.currentArticle?.is_favorite : false);

    const newFavoriteState = !wasFavorite;

    // Optimistic update: flip immediately
    set((s) => ({
      optimisticFavorites: { ...s.optimisticFavorites, [id]: newFavoriteState },
      currentArticle:
        s.currentArticle?.id === id
          ? { ...s.currentArticle, is_favorite: newFavoriteState }
          : s.currentArticle,
    }));

    try {
      if (newFavoriteState) {
        await articlesApi.favorite(id);
      } else {
        await articlesApi.unfavorite(id);
      }
      // Clear optimistic entry after successful API call (real data will come from refetch)
      set((s) => {
        const updated = { ...s.optimisticFavorites };
        delete updated[id];
        return { optimisticFavorites: updated };
      });
    } catch (err) {
      // Rollback on error
      set((s) => {
        const updated = { ...s.optimisticFavorites };
        delete updated[id];
        return {
          optimisticFavorites: updated,
          currentArticle:
            s.currentArticle?.id === id
              ? { ...s.currentArticle, is_favorite: wasFavorite }
              : s.currentArticle,
          error: err instanceof Error ? err.message : 'Ошибка',
        };
      });
    }
  },

  setCurrentArticle: (article) => set({ currentArticle: article }),
  clearError: () => set({ error: null }),
}));
