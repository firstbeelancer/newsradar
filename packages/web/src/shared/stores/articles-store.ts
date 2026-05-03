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
}

interface ArticlesActions {
  setFilters: (filters: Partial<ArticleFilters>) => void;
  setSearchQuery: (query: string) => void;
  toggleArticleSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
  fetchArticle: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
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

  toggleFavorite: async (id) => {
    try {
      await articlesApi.favorite(id);
      set((state) => ({
        currentArticle:
          state.currentArticle?.id === id
            ? { ...state.currentArticle, is_favorite: !state.currentArticle.is_favorite }
            : state.currentArticle,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Ошибка' });
    }
  },

  setCurrentArticle: (article) => set({ currentArticle: article }),
  clearError: () => set({ error: null }),
}));
