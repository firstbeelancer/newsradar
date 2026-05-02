import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'user' | 'admin';
}

interface AuthState {
  user: User | null;
  access_token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  clearError: () => void;
}

const initialState: AuthState = {
  user: null,
  access_token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      ...initialState,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Ошибка входа');
          }

          const data = await response.json();
          set({
            user: data.user,
            access_token: data.access_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Неизвестная ошибка',
            isLoading: false,
            isAuthenticated: false,
          });
          throw err;
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Ошибка регистрации');
          }

          const data = await response.json();
          set({
            user: data.user,
            access_token: data.access_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Неизвестная ошибка',
            isLoading: false,
            isAuthenticated: false,
          });
          throw err;
        }
      },

      logout: () => {
        set({
          user: null,
          access_token: null,
          isAuthenticated: false,
          error: null,
        });
        window.location.href = '/login';
      },

      setUser: (user) => set({ user }),
      setToken: (token) => set({ access_token: token, isAuthenticated: true }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'newsradar_auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        access_token: state.access_token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
