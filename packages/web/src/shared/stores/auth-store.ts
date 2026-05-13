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
  workspace_id: string | null;
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
  setWorkspaceId: (workspaceId: string) => void;
  clearError: () => void;
}

interface AuthEnvelope {
  success?: boolean;
  data?: AuthPayload;
  user?: Partial<User>;
  userId?: string;
  workspaceId?: string;
  workspace_id?: string;
  accessToken?: string;
  access_token?: string;
  message?: string;
  error?: { message?: string } | string;
}

interface AuthPayload {
  user?: Partial<User>;
  userId?: string;
  workspaceId?: string;
  workspace_id?: string;
  accessToken?: string;
  access_token?: string;
}

const initialState: AuthState = {
  user: null,
  access_token: null,
  workspace_id: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  const obj = payload as AuthEnvelope;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  if (obj.error && typeof obj.error === 'object' && typeof obj.error.message === 'string') {
    return obj.error.message;
  }
  return fallback;
}

function normalizeAuthPayload(payload: AuthEnvelope, fallback: { email: string; name?: string }) {
  const data = payload.data ?? payload;
  const token = data.access_token ?? data.accessToken;
  const workspaceId = data.workspace_id ?? data.workspaceId;
  const userPayload = data.user;
  const userId = userPayload?.id ?? data.userId;

  if (!token || !userId) {
    throw new Error('Некорректный ответ сервера авторизации');
  }

  const email = userPayload?.email ?? fallback.email;
  const name = userPayload?.name ?? fallback.name ?? email.split('@')[0];

  return {
    access_token: token,
    workspace_id: workspaceId ?? null,
    user: {
      id: userId,
      email,
      name,
      avatar: userPayload?.avatar,
      role: userPayload?.role ?? 'user',
    } satisfies User,
  };
}

async function readJsonSafe(response: Response) {
  return response.json().catch(() => ({}));
}

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

          const body = await readJsonSafe(response) as AuthEnvelope;
          if (!response.ok) {
            throw new Error(getErrorMessage(body, 'Ошибка входа'));
          }

          const auth = normalizeAuthPayload(body, { email });
          set({
            user: auth.user,
            access_token: auth.access_token,
            workspace_id: auth.workspace_id,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Неизвестная ошибка',
            isLoading: false,
            isAuthenticated: false,
            access_token: null,
            workspace_id: null,
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

          const body = await readJsonSafe(response) as AuthEnvelope;
          if (!response.ok) {
            throw new Error(getErrorMessage(body, 'Ошибка регистрации'));
          }

          const auth = normalizeAuthPayload(body, { email, name });
          set({
            user: auth.user,
            access_token: auth.access_token,
            workspace_id: auth.workspace_id,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Неизвестная ошибка',
            isLoading: false,
            isAuthenticated: false,
            access_token: null,
            workspace_id: null,
          });
          throw err;
        }
      },

      logout: async () => {
        try {
          await fetch('/api/v1/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch {
          // Ignore logout error
        }
        set({
          user: null,
          access_token: null,
          workspace_id: null,
          isAuthenticated: false,
          error: null,
        });
        window.location.href = '/login';
      },

      setUser: (user) => set({ user }),
      setToken: (token) => set({ access_token: token, isAuthenticated: Boolean(token) }),
      setWorkspaceId: (workspaceId) => set({ workspace_id: workspaceId }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'newsradar_auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        access_token: state.access_token,
        workspace_id: state.workspace_id,
        isAuthenticated: state.isAuthenticated && Boolean(state.access_token),
      }),
    }
  )
);
