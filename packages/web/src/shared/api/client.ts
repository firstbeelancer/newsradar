import { useAuthStore } from '@shared/stores/auth-store';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new ApiError(401, 'Не авторизован');
  }

  if (!response.ok) {
    let errorMessage = `Ошибка ${response.status}`;
    let errorData: unknown;
    try {
      errorData = await response.json();
      if (errorData && typeof errorData === 'object' && 'message' in errorData) {
        errorMessage = (errorData as { message: string }).message;
      }
    } catch {
      // Ignore JSON parse error
    }
    throw new ApiError(response.status, errorMessage, errorData);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = useAuthStore.getState().access_token;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<T>(response);
}

export async function apiPost<T, B = unknown>(path: string, body: B): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiPut<T, B = unknown>(path: string, body: B): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiPatch<T, B = unknown>(path: string, body: B): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return handleResponse<T>(response);
}

// SSE subscription helper
export function subscribeToSSE<T>(path: string, onMessage: (data: T) => void, onError?: (error: Event) => void): () => void {
  const token = useAuthStore.getState().access_token;
  const url = `${API_BASE}${path}`;
  
  const eventSource = new EventSource(url, {
    withCredentials: true,
  });

  // If token exists, we need to handle auth differently since EventSource doesn't support custom headers
  // The backend should support cookie-based auth for SSE, or we use fetch-based SSE alternative
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as T;
      onMessage(data);
    } catch {
      // If not JSON, pass raw string
      onMessage(event.data as unknown as T);
    }
  };

  eventSource.onerror = (error) => {
    onError?.(error);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  next_cursor?: string | null;
  has_more: boolean;
}

// ─── Agent Types ─────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  position: number;
  is_active: boolean;
  article_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentDto {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  position?: number;
  is_active?: boolean;
}

export interface UpdateAgentDto {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  position?: number;
  is_active?: boolean;
}

export interface AgentStats {
  total_articles: number;
  total_sources: number;
  last_collection_at?: string;
  avg_articles_per_day: number;
}

// ─── Source Types ────────────────────────────────────────────────────────────

export type SourceType = 'rss' | 'telegram';

export interface Source {
  id: string;
  agent_id: string;
  name: string;
  url: string;
  type: SourceType;
  is_active: boolean;
  fetch_count: number;
  last_fetch_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSourceDto {
  agent_id: string;
  name: string;
  url: string;
  type: SourceType;
  is_active?: boolean;
}

export interface UpdateSourceDto {
  name?: string;
  url?: string;
  type?: SourceType;
  is_active?: boolean;
}

export interface SourceTestResult {
  success: boolean;
  message: string;
  articles_found?: number;
  sample_titles?: string[];
}

// ─── Article Types ───────────────────────────────────────────────────────────

export interface Article {
  id: string;
  title: string;
  description: string;
  content?: string;
  url: string;
  source_name: string;
  source_url?: string;
  agent_id: string;
  agent_name?: string;
  published_at: string;
  collected_at: string;
  score: number;
  is_favorite: boolean;
  status: 'new' | 'read' | 'archived';
  metadata?: Record<string, unknown>;
}

export interface ArticleFilters {
  agent_id?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  favorites_only?: boolean;
}

// ─── Template Types ──────────────────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  type: 'post' | 'digest';
  system_prompt: string;
  user_prompt: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateDto {
  name: string;
  type: 'post' | 'digest';
  system_prompt: string;
  user_prompt: string;
  is_default?: boolean;
}

// ─── Generation Types ────────────────────────────────────────────────────────

export interface GeneratePostDto {
  article_ids: string[];
  template_id?: string;
  provider?: string;
  model?: string;
}

export interface GenerateDigestDto {
  agent_id: string;
  period: 'day' | 'week' | 'month';
  template_id?: string;
  provider?: string;
  model?: string;
}

export interface GenerationResult {
  op_id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  content?: string;
  error?: string;
}

export interface GeneratedPost {
  id: string;
  type: 'post' | 'digest';
  content: string;
  provider: string;
  model: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ─── Scoring Types ───────────────────────────────────────────────────────────

export interface ScoringConfig {
  ai_relevance: number;
  keyword_match: number;
  freshness: number;
  source_trust: number;
}

// ─── API Functions ───────────────────────────────────────────────────────────

// Agents
export const agentsApi = {
  list: (cursor?: string, limit = 20) =>
    apiGet<CursorPaginatedResponse<Agent>>(`/agents?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  get: (id: string) => apiGet<Agent>(`/agents/${id}`),
  create: (data: CreateAgentDto) => apiPost<Agent, CreateAgentDto>('/agents', data),
  update: (id: string, data: UpdateAgentDto) => apiPut<Agent, UpdateAgentDto>(`/agents/${id}`, data),
  delete: (id: string) => apiDelete<void>(`/agents/${id}`),
  stats: (id: string) => apiGet<AgentStats>(`/agents/${id}/stats`),
  collect: (id: string) => apiPost<{ op_id: string }>(`/agents/${id}/collect`, {}),
  sources: (id: string) => apiGet<Source[]>(`/agents/${id}/sources`),
};

// Sources
export const sourcesApi = {
  list: () => apiGet<Source[]>('/sources'),
  create: (data: CreateSourceDto) => apiPost<Source, CreateSourceDto>('/sources', data),
  update: (id: string, data: UpdateSourceDto) => apiPut<Source, UpdateSourceDto>(`/sources/${id}`, data),
  delete: (id: string) => apiDelete<void>(`/sources/${id}`),
  test: (id: string) => apiPost<SourceTestResult>(`/sources/${id}/test`, {}),
  fetch: (id: string) => apiPost<{ op_id: string }>(`/sources/${id}/fetch`, {}),
};

// Articles
export const articlesApi = {
  list: (filters?: ArticleFilters, cursor?: string, limit = 20) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (cursor) params.set('cursor', cursor);
    if (filters?.agent_id) params.set('agent_id', filters.agent_id);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.date_from) params.set('date_from', filters.date_from);
    if (filters?.date_to) params.set('date_to', filters.date_to);
    if (filters?.favorites_only) params.set('favorites_only', '1');
    return apiGet<CursorPaginatedResponse<Article>>(`/articles?${params.toString()}`);
  },
  search: (q: string, cursor?: string, limit = 20) => {
    const params = new URLSearchParams();
    params.set('q', q);
    params.set('limit', String(limit));
    if (cursor) params.set('cursor', cursor);
    return apiGet<CursorPaginatedResponse<Article>>(`/articles/search?${params.toString()}`);
  },
  get: (id: string) => apiGet<Article>(`/articles/${id}`),
  favorite: (id: string) => apiPost<void>(`/articles/${id}/favorite`, {}),
};

// Templates
export const templatesApi = {
  list: () => apiGet<Template[]>('/templates'),
  create: (data: CreateTemplateDto) => apiPost<Template, CreateTemplateDto>('/templates', data),
  update: (id: string, data: Partial<CreateTemplateDto>) => apiPut<Template, Partial<CreateTemplateDto>>(`/templates/${id}`, data),
  delete: (id: string) => apiDelete<void>(`/templates/${id}`),
};

// Generation
export const generationApi = {
  generatePost: (data: GeneratePostDto) => apiPost<GenerationResult, GeneratePostDto>('/generation/post', data),
  generateDigest: (data: GenerateDigestDto) => apiPost<GenerationResult, GenerateDigestDto>('/generation/digest', data),
  stream: (opId: string, onMessage: (chunk: string) => void, onError?: (error: Event) => void) =>
    subscribeToSSE<{ chunk?: string; done?: boolean; error?: string }>(`/generation/stream/${opId}`, (data) => {
      if (typeof data === 'string') {
        onMessage(data);
      } else if (data && typeof data === 'object') {
        if ('chunk' in data && data.chunk) onMessage(data.chunk as string);
        if ('error' in data && data.error) onMessage(`Error: ${data.error}`);
      }
    }, onError),
  history: (cursor?: string, limit = 20) =>
    apiGet<CursorPaginatedResponse<GeneratedPost>>(`/generated-posts?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  updatePost: (id: string, content: string) => apiPut<GeneratedPost, { content: string }>(`/generated-posts/${id}`, { content }),
};

// Scoring
export const scoringApi = {
  getConfig: () => apiGet<ScoringConfig>('/scoring/config'),
  updateConfig: (data: ScoringConfig) => apiPost<ScoringConfig, ScoringConfig>('/scoring/config', data),
  recalculate: () => apiPost<void>('/scoring/recalculate', {}),
};
