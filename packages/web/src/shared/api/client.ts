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

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: { message?: string } | string;
  next_cursor?: string | null;
  has_more?: boolean;
}

// ─── Backend response shapes (what the API actually returns) ─────────────────

interface BackendCursorResponse<T> {
  data: T[];
  nextCursor?: string | null;
  hasMore?: boolean;
  next_cursor?: string | null;
  has_more?: boolean;
}

interface BackendAgent {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  position?: number | null;
  isActive?: boolean;
  is_active?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  articleCount?: number;
  article_count?: number;
  sourceCount?: number;
  source_count?: number;
  subjectArea?: string | null;
  subject_area?: string | null;
  config?: Record<string, unknown>;
  scoringCriteria?: unknown[];
  chipFilters?: unknown[];
}

interface BackendChipFilter {
  id: string;
  agentId?: string;
  agent_id?: string;
  key: string;
  label: string;
  description?: string | null;
  pattern?: string | null;
  operator: ChipFilter["operator"];
  scoreModifier?: string | number | null;
  score_modifier?: string | number | null;
  color?: string | null;
  icon?: string | null;
  isActive?: boolean;
  is_active?: boolean;
  position?: number | null;
}

interface BackendArticle {
  id: string;
  title: string;
  description?: string | null;
  aiSummary?: string | null;
  ai_summary?: string | null;
  content?: string | null;
  originalDescription?: string | null;
  original_description?: string | null;
  link?: string;
  url?: string;
  publishedAt?: string | null;
  published_at?: string | null;
  createdAt?: string;
  created_at?: string;
  collectedAt?: string;
  collected_at?: string;
  score?: string | number | null;
  isFavorite?: boolean;
  is_favorite?: boolean;
  status?: string | null;
  language?: string | null;
  sourceId?: string;
  source_id?: string;
  sourceName?: string | null;
  source_name?: string | null;
  sourceUrl?: string | null;
  source_url?: string | null;
  agentId?: string;
  agent_id?: string;
  agentName?: string | null;
  agent_name?: string | null;
  agentColor?: string | null;
  agent_color?: string | null;
  metadata?: Record<string, unknown>;
}

interface BackendGeneratedPost {
  id: string;
  title?: string | null;
  content: string;
  type: 'manual' | 'digest' | 'deepsearch' | 'post';
  articleCount?: number;
  article_count?: number;
  articlesSnapshot?: Array<{ id?: string; title?: string; link?: string; score?: number }>;
  articles_snapshot?: Array<{ id?: string; title?: string; link?: string; score?: number }>;
  templateId?: string | null;
  template_id?: string | null;
  modelSnapshot?: string | null;
  model?: string | null;
  provider?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  isEdited?: boolean;
  is_edited?: boolean;
  isCopied?: boolean;
  is_copied?: boolean;
  agentId?: string;
  agent_id?: string;
}

interface BackendOperationLog {
  id: string;
  operationType?: string;
  operation_type?: string;
  entityType?: string | null;
  entity_type?: string | null;
  entityId?: string | null;
  entity_id?: string | null;
  status: string;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  agentId?: string | null;
  agent_id?: string | null;
  createdAt?: string;
  created_at?: string;
  startedAt?: string;
  started_at?: string;
  finishedAt?: string | null;
  finished_at?: string | null;
}

interface BackendDeepSearchResult {
  id: string;
  agentId?: string | null;
  agent_id?: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | string;
  query?: string;
  findings?: Record<string, unknown>;
  reportText?: string | null;
  report_text?: string | null;
  error?: string | null;
  errorMessage?: string | null;
  error_message?: string | null;
  createdAt?: string;
  created_at?: string;
  startedAt?: string | null;
  started_at?: string | null;
  finishedAt?: string | null;
  finished_at?: string | null;
}

interface BackendDashboardSummary {
  totalArticles?: number;
  total_articles?: number;
  favoriteCount?: number;
  favorite_count?: number;
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeCursorResponse<TInput, TOutput>(
  payload: BackendCursorResponse<TInput>,
  mapItem: (item: TInput) => TOutput
): CursorPaginatedResponse<TOutput> {
  return {
    data: payload.data.map(mapItem),
    next_cursor: payload.next_cursor ?? payload.nextCursor ?? null,
    has_more: payload.has_more ?? payload.hasMore ?? false,
  };
}

function normalizeChipFilter(raw: BackendChipFilter): ChipFilter {
  return {
    id: raw.id,
    agentId: raw.agent_id ?? raw.agentId ?? '',
    key: raw.key,
    label: raw.label,
    description: raw.description ?? null,
    pattern: raw.pattern ?? null,
    operator: raw.operator,
    scoreModifier:
      typeof raw.scoreModifier === 'number'
        ? raw.scoreModifier
        : typeof raw.score_modifier === 'number'
          ? raw.score_modifier
          : Number(raw.scoreModifier ?? raw.score_modifier ?? 0),
    color: raw.color ?? 'default',
    icon: raw.icon ?? null,
    isActive: raw.is_active ?? raw.isActive ?? true,
    position: raw.position ?? 0,
  };
}

export function normalizeAgent(raw: BackendAgent): Agent {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    icon: raw.icon ?? '',
    color: raw.color ?? '#0ea5e9',
    position: raw.position ?? 0,
    is_active: raw.is_active ?? raw.isActive ?? true,
    article_count: Number(raw.article_count ?? raw.articleCount ?? 0),
    source_count: Number(raw.source_count ?? raw.sourceCount ?? 0),
    subjectArea: raw.subject_area ?? raw.subjectArea ?? null,
    config: (raw.config as Agent['config']) ?? {},
    scoringCriteria: raw.scoringCriteria as Agent['scoringCriteria'] ?? undefined,
    chipFilters: Array.isArray(raw.chipFilters)
      ? raw.chipFilters.map((filter) => normalizeChipFilter(filter as BackendChipFilter))
      : undefined,
    created_at: raw.created_at ?? raw.createdAt ?? new Date(0).toISOString(),
    updated_at: raw.updated_at ?? raw.updatedAt ?? new Date(0).toISOString(),
  };
}

export function normalizeArticle(raw: BackendArticle): Article {
  const publishedAt = raw.published_at ?? raw.publishedAt ?? raw.created_at ?? raw.createdAt ?? new Date(0).toISOString();
  const createdAt = raw.created_at ?? raw.createdAt ?? publishedAt;
  const collectedAt = raw.collected_at ?? raw.collectedAt ?? createdAt;
  const normalizedScore = normalizeArticleScore(raw.score);

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? '',
    ai_summary: raw.ai_summary ?? raw.aiSummary ?? undefined,
    content: raw.content ?? undefined,
    original_description: raw.original_description ?? raw.originalDescription ?? undefined,
    url: raw.url ?? raw.link ?? '',
    source_id: raw.source_id ?? raw.sourceId ?? '',
    source_name: raw.source_name ?? raw.sourceName ?? raw.source_id ?? raw.sourceId ?? 'Источник',
    source_url: raw.source_url ?? raw.sourceUrl ?? undefined,
    agent_id: raw.agent_id ?? raw.agentId ?? '',
    agent_name: raw.agent_name ?? raw.agentName ?? undefined,
    agent_color: raw.agent_color ?? raw.agentColor ?? undefined,
    published_at: publishedAt,
    collected_at: collectedAt,
    score: normalizedScore,
    is_favorite: raw.is_favorite ?? raw.isFavorite ?? false,
    status: (raw.status as Article['status']) ?? 'new',
    language: raw.language ?? undefined,
    metadata: raw.metadata,
  };
}

function normalizeArticleScore(rawScore: string | number | null | undefined): number {
  if (typeof rawScore === 'number') {
    return clampArticleScore(rawScore);
  }

  if (typeof rawScore === 'string') {
    const parsed = Number.parseFloat(rawScore.replace(',', '.').trim());
    if (Number.isFinite(parsed)) {
      return clampArticleScore(parsed);
    }
  }

  return 0;
}

function clampArticleScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score > 100) {
    if (score <= 10000) {
      return Math.max(0, Math.min(score / 100, 100));
    }
    return 100;
  }
  if (score < 0) return 0;
  return score;
}

export function normalizeGeneratedPost(raw: BackendGeneratedPost): GeneratedPost {
  const articlesSnapshot = raw.articles_snapshot ?? raw.articlesSnapshot ?? [];

  return {
    id: raw.id,
    title: raw.title ?? null,
    type: raw.type === 'manual' ? 'post' : raw.type,
    content: raw.content,
    provider: raw.provider ?? 'AI',
    model: raw.model ?? raw.modelSnapshot ?? 'default',
    metadata: raw.metadata,
    article_count: raw.article_count ?? raw.articleCount ?? articlesSnapshot.length,
    article_ids: articlesSnapshot.map((article) => article.id).filter((id): id is string => Boolean(id)),
    articles_snapshot: articlesSnapshot,
    template_id: raw.template_id ?? raw.templateId ?? null,
    agent_id: raw.agent_id ?? raw.agentId ?? null,
    created_at: raw.created_at ?? raw.createdAt ?? new Date(0).toISOString(),
  };
}

export function normalizeOperationLog(raw: BackendOperationLog): OperationLog {
  const createdAt = raw.created_at ?? raw.createdAt ?? raw.started_at ?? raw.startedAt ?? new Date(0).toISOString();

  return {
    id: raw.id,
    operation_type: raw.operation_type ?? raw.operationType ?? 'operation',
    entity_type: raw.entity_type ?? raw.entityType ?? undefined,
    entity_id: raw.entity_id ?? raw.entityId ?? undefined,
    status: raw.status as OperationLog['status'],
    message: raw.message ?? undefined,
    metadata: raw.metadata ?? undefined,
    agent_id: raw.agent_id ?? raw.agentId ?? undefined,
    created_at: createdAt,
    started_at: raw.started_at ?? raw.startedAt ?? createdAt,
    finished_at: raw.finished_at ?? raw.finishedAt ?? undefined,
  };
}

export function normalizeGenerationResult(
  payload: { operationId?: string; op_id?: string; status?: string; content?: string; error?: string }
): GenerationResult {
  return {
    op_id: payload.op_id ?? payload.operationId ?? '',
    status: (payload.status as GenerationResult['status']) ?? 'pending',
    content: payload.content,
    error: payload.error,
  };
}

export function normalizeDeepSearchResult(raw: BackendDeepSearchResult): DeepSearchResult {
  return {
    id: raw.id,
    agent_id: raw.agent_id ?? raw.agentId ?? null,
    status: raw.status as DeepSearchResult['status'],
    query: raw.query,
    findings: raw.findings,
    report_text: raw.report_text ?? raw.reportText ?? null,
    error: raw.error ?? raw.error_message ?? raw.errorMessage ?? null,
    created_at: raw.created_at ?? raw.createdAt ?? new Date(0).toISOString(),
    started_at: raw.started_at ?? raw.startedAt ?? null,
    finished_at: raw.finished_at ?? raw.finishedAt ?? null,
  };
}

function readErrorMessage(errorData: unknown, fallback: string) {
  if (!errorData || typeof errorData !== 'object') return fallback;
  const obj = errorData as ApiEnvelope<unknown>;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  if (obj.error && typeof obj.error === 'object' && typeof obj.error.message === 'string') {
    return obj.error.message;
  }
  return fallback;
}

function unwrapResponse<T>(body: ApiEnvelope<T> | T): T {
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    return (body as ApiEnvelope<T>).data as T;
  }
  return body as T;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    useAuthStore.getState().logout();
    throw new ApiError(401, 'Не авторизован');
  }

  let body: unknown = undefined;
  if (response.status !== 204) {
    body = await response.json().catch(() => undefined);
  }

  if (!response.ok) {
    throw new ApiError(response.status, readErrorMessage(body, `Ошибка ${response.status}`), body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return unwrapResponse<T>(body as ApiEnvelope<T> | T);
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

function withWorkspace(path: string) {
  const workspaceId = useAuthStore.getState().workspace_id;
  if (!workspaceId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}workspaceId=${encodeURIComponent(workspaceId)}`;
}

export async function apiGet<T>(path: string, options?: { workspace?: boolean }): Promise<T> {
  const response = await fetch(`${API_BASE}${options?.workspace === false ? path : withWorkspace(path)}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<T>(response);
}

export async function apiPost<T, B = unknown>(path: string, body: B, options?: { workspace?: boolean }): Promise<T> {
  const response = await fetch(`${API_BASE}${options?.workspace === false ? path : withWorkspace(path)}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiPut<T, B = unknown>(path: string, body: B, options?: { workspace?: boolean }): Promise<T> {
  const response = await fetch(`${API_BASE}${options?.workspace === false ? path : withWorkspace(path)}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiPatch<T, B = unknown>(path: string, body: B, options?: { workspace?: boolean }): Promise<T> {
  const response = await fetch(`${API_BASE}${options?.workspace === false ? path : withWorkspace(path)}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiDelete<T>(path: string, options?: { workspace?: boolean }): Promise<T> {
  const response = await fetch(`${API_BASE}${options?.workspace === false ? path : withWorkspace(path)}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return handleResponse<T>(response);
}

// SSE subscription helper
// EventSource can't send Authorization headers, so we use fetch+ReadableStream
export function subscribeToSSE<T>(path: string, onMessage: (data: T) => void, onError?: (error: Event) => void): () => void {
  const url = `${API_BASE}${withWorkspace(path)}`;
  const token = useAuthStore.getState().access_token;
  let aborted = false;

  // Use fetch with ReadableStream instead of EventSource to support Bearer auth
  fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'text/event-stream',
    },
  })
    .then(async (response) => {
      if (!response.ok || !response.body) {
        onError?.(new Event(`HTTP ${response.status}`));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr) as T;
              onMessage(data);
            } catch {
              onMessage(dataStr as unknown as T);
            }
          }
        }
      }
    })
    .catch((err) => {
      if (!aborted) onError?.(err);
    });

  return () => {
    aborted = true;
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

export interface ScoringCriterion {
  id: string;
  agentId: string;
  criterionType: 'ai_relevance' | 'keyword_match' | 'freshness' | 'source_trust' | 'custom';
  label: string;
  weight: number;
  threshold?: number | null;
  isActive: boolean;
  position: number;
  config: Record<string, unknown>;
}

export interface ChipFilter {
  id: string;
  agentId: string;
  key: string;
  label: string;
  description?: string | null;
  pattern?: string | null;
  operator: 'contains' | 'not_contains' | 'equals' | 'starts_with' | 'regex' | 'in' | 'gt' | 'lt' | 'gte' | 'lte';
  scoreModifier: number;
  color: string;
  icon?: string | null;
  isActive: boolean;
  position: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  position: number;
  is_active: boolean;
  article_count?: number;
  source_count?: number;
  subjectArea?: string | null;
  config: {
    targetAudience?: string;
    tone?: string;
    systemPrompt?: string;
    userPrompt?: string;
    tags?: string[];
    scoringWeights?: {
      relevance: number;
      novelty: number;
      hype: number;
      practical: number;
      local: number;
    };
    chipFilters?: Partial<ChipFilter>[];
    fetchSchedule?: string;
    assetPackId?: string;
  };
  scoringCriteria?: ScoringCriterion[];
  chipFilters?: ChipFilter[];
  created_at: string;
  updated_at: string;
}

export interface CreateAgentDto {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  position?: number;
  subjectArea?: string;
  config?: {
    targetAudience?: string;
    tone?: string;
    systemPrompt?: string;
    userPrompt?: string;
    tags?: string[];
    scoringWeights?: {
      relevance: number;
      novelty: number;
      hype: number;
      practical: number;
      local: number;
    };
    chipFilters?: Partial<ChipFilter>[];
    fetchSchedule?: string;
  };
}

export interface UpdateAgentDto {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  position?: number;
  subjectArea?: string;
  config?: Agent['config'];
}

export interface AgentStats {
  total_articles?: number;
  total_sources?: number;
  last_collection_at?: string;
  avg_articles_per_day?: number;
  sourceCount?: number;
  articleCount?: number;
  todayCount?: number;
  statusBreakdown?: Record<string, number>;
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

interface BackendSource {
  id: string;
  name: string;
  url: string;
  type: SourceType;
  agentId?: string;
  agent_id?: string;
  isActive?: boolean;
  is_active?: boolean;
  fetchCount?: number;
  fetch_count?: number;
  lastFetchAt?: string | null;
  last_fetch_at?: string | null;
  lastError?: string | null;
  last_error?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  workspaceId?: string;
  workspace_id?: string;
  channelUsername?: string | null;
  fetchSchedule?: string | null;
}

export function normalizeSource(raw: BackendSource): Source {
  return {
    id: raw.id,
    agent_id: raw.agent_id ?? raw.agentId ?? '',
    name: raw.name,
    url: raw.url,
    type: raw.type,
    is_active: raw.is_active ?? raw.isActive ?? true,
    fetch_count: raw.fetch_count ?? raw.fetchCount ?? 0,
    last_fetch_at: raw.last_fetch_at ?? raw.lastFetchAt ?? undefined,
    last_error: raw.last_error ?? raw.lastError ?? undefined,
    created_at: raw.created_at ?? raw.createdAt ?? new Date(0).toISOString(),
    updated_at: raw.updated_at ?? raw.updatedAt ?? new Date(0).toISOString(),
  };
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
  isActive?: boolean;
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
  ai_summary?: string;
  content?: string;
  original_description?: string;
  url: string;
  source_id: string;
  source_name: string;
  source_url?: string;
  agent_id: string;
  agent_name?: string;
  agent_color?: string;
  published_at: string;
  collected_at: string;
  score: number;
  is_favorite: boolean;
  status: 'new' | 'read' | 'archived' | 'fetched' | 'translated' | 'analyzed' | 'scored' | 'deduped' | 'published';
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface ArticleFilters {
  agent_id?: string;
  source_id?: string;
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  favorites_only?: boolean;
  sort_by?: 'date' | 'score';
  sort_order?: 'asc' | 'desc';
}

export interface ArticleSelectionResult {
  article_ids: string[];
  selected_count: number;
  capped: boolean;
  max_ids: number;
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
  custom_prompt?: string;
  provider?: string;
  model?: string;
}

export interface GenerateDigestDto {
  agent_id?: string;
  article_ids?: string[];
  article_count?: number;
  period?: 'day' | 'week' | 'month';
  template_id?: string;
  custom_prompt?: string;
  provider?: string;
  model?: string;
}

export interface StartDeepSearchDto {
  article_id: string;
  agent_id?: string;
  custom_prompt?: string;
}

export interface GenerationResult {
  op_id: string;
  status: 'pending' | 'processing' | 'queued' | 'completed' | 'error';
  content?: string;
  error?: string;
}

export interface DeepSearchStartResult extends GenerationResult {
  result_id?: string;
  operation_log_id?: string;
}

export interface DeepSearchResult {
  id: string;
  agent_id?: string | null;
  status: 'pending' | 'running' | 'queued' | 'completed' | 'failed' | string;
  query?: string;
  findings?: Record<string, unknown>;
  report_text?: string | null;
  error?: string | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
}

export type DeepSearchWebSearchProvider = 'disabled' | 'brave' | 'tavily' | 'serpapi' | 'perplexity' | 'grok';

export interface DeepSearchWebSearchSettings {
  provider: DeepSearchWebSearchProvider;
  hasApiKey: boolean;
  apiKey?: string;
  clearApiKey?: boolean;
  baseUrl?: string;
  model?: string;
  maxResults: number;
}

export interface DeepSearchWebSearchTestResult {
  ok: boolean;
  message: string;
  resultCount?: number;
}

export interface GenerationStreamState {
  status: 'pending' | 'generating' | 'completed' | 'error';
  content: string;
  error?: string;
}

export interface GeneratedPost {
  id: string;
  title?: string | null;
  type: 'post' | 'digest' | 'deepsearch';
  content: string;
  provider: string;
  model: string;
  metadata?: Record<string, unknown>;
  article_count: number;
  article_ids: string[];
  articles_snapshot: Array<{ id?: string; title?: string; link?: string; score?: number }>;
  template_id?: string | null;
  agent_id?: string | null;
  created_at: string;
}

export interface OperationLog {
  id: string;
  operation_type: string;
  entity_type?: string;
  entity_id?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial' | 'cancelled' | string;
  message?: string;
  metadata?: Record<string, unknown>;
  agent_id?: string;
  created_at: string;
  started_at: string;
  finished_at?: string;
}

export interface DashboardSummary {
  total_articles: number;
  favorite_count: number;
}

// ─── Scoring Types ───────────────────────────────────────────────────────────

export interface ScoringConfig {
  ai_relevance: number;
  keyword_match: number;
  freshness: number;
  source_trust: number;
  exclusive?: boolean;
  actionable?: boolean;
  trending?: boolean;
  controversy?: boolean;
  verified?: boolean;
}

// ─── Subscription Types ──────────────────────────────────────────────────────

export type PlanType = 'free' | 'pro';

export interface Subscription {
  plan: PlanType;
  status: 'active' | 'canceled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export interface SubscriptionLimits {
  favorites_used: number;
  favorites_limit: number;
  collections_used: number;
  collections_limit: number;
  agents_used: number;
  agents_limit: number;
  sources_used: number;
  sources_limit: number;
  generation_used: number;
  generation_limit: number;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  description: string;
  created_at: string;
  paid_at?: string;
}

export interface CreatePaymentResponse {
  confirmation_url: string;
}

// ─── iBoard Types ────────────────────────────────────────────────────────────

export interface IBoardStats {
  total_articles: number;
  avg_score: number;
  active_sources: number;
  news_today: number;
}

export interface TimelinePoint {
  date: string;
  count: number;
}

export interface LeaderboardArticle {
  id: string;
  title: string;
  source_name: string;
  score: number;
  published_at: string;
}

export interface SourceHealth {
  id: string;
  name: string;
  url: string;
  type: string;
  status: 'healthy' | 'warning' | 'error' | 'inactive';
  last_fetch_at?: string;
  last_error?: string;
  fetch_success_rate: number;
  articles_count_7d: number;
}

// ─── Notification Types ──────────────────────────────────────────────────────

export type NotificationType = 'system' | 'article' | 'agent' | 'subscription' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  data?: Record<string, unknown>;
  created_at: string;
}

// ─── API Functions ───────────────────────────────────────────────────────────

// Agents
export const agentsApi = {
  list: (cursor?: string, limit = 20) =>
    apiGet<BackendCursorResponse<BackendAgent>>(`/agents?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`).then((payload) =>
      normalizeCursorResponse(payload, normalizeAgent)
    ),
  get: (id: string) => apiGet<BackendAgent>(`/agents/${id}`).then(normalizeAgent),
  create: (data: CreateAgentDto) => apiPost<BackendAgent, CreateAgentDto>('/agents', data).then(normalizeAgent),
  update: (id: string, data: UpdateAgentDto) => apiPut<BackendAgent, UpdateAgentDto>(`/agents/${id}`, data).then(normalizeAgent),
  delete: (id: string) => apiDelete<void>(`/agents/${id}`),
  stats: (id: string) => apiGet<AgentStats>(`/agents/${id}/stats`),
  collect: (id: string) => apiPost<{ operationId?: string; op_id?: string }>(`/agents/${id}/collect`, {}).then((payload) => ({
    op_id: payload.op_id ?? payload.operationId ?? '',
  })),
  sources: (id: string) => apiGet<{ data: BackendSource[] }>(`/agents/${id}/sources`).then((res) =>
    (Array.isArray(res) ? res : res.data ?? []).map(normalizeSource)
  ),
  linkSource: (agentId: string, sourceId: string) =>
    apiPost<{ agentId: string; sourceId: string }, { sourceId: string }>(`/agents/${agentId}/sources`, { sourceId }),
  unlinkSource: (agentId: string, sourceId: string) =>
    apiDelete<void>(`/agents/${agentId}/sources/${sourceId}`),
  toggleSource: (sourceId: string, isActive: boolean) =>
    apiPut<BackendSource, { isActive: boolean }>(`/sources/${sourceId}`, { isActive }).then(normalizeSource),
};

// Scoring Criteria
export const scoringCriteriaApi = {
  list: (agentId: string) => apiGet<ScoringCriterion[]>(`/scoring/agents/${agentId}/criteria`),
  create: (agentId: string, data: Omit<ScoringCriterion, 'id' | 'agentId' | 'position' | 'config'> & { config?: Record<string, unknown> }) =>
    apiPost<ScoringCriterion>(`/scoring/agents/${agentId}/criteria`, data),
  update: (criterionId: string, data: Partial<ScoringCriterion>) =>
    apiPatch<ScoringCriterion>(`/scoring/criteria/${criterionId}`, data),
  delete: (criterionId: string) => apiDelete<void>(`/scoring/criteria/${criterionId}`),
  reorder: (agentId: string, orderedIds: string[]) =>
    apiPost<ScoringCriterion[]>(`/scoring/agents/${agentId}/criteria/reorder`, { orderedIds }),
  recalculate: (agentId: string) => apiPost<{ articlesQueued: number }>(`/scoring/agents/${agentId}/recalculate`, {}),
};

// Chip Filters
export const chipFiltersApi = {
  list: (agentId: string) => apiGet<BackendChipFilter[]>(`/chip-filters/agents/${agentId}`).then((filters) =>
    filters.map(normalizeChipFilter)
  ),
  create: (agentId: string, data: Omit<ChipFilter, 'id' | 'agentId' | 'position'>) =>
    apiPost<BackendChipFilter>(`/chip-filters/agents/${agentId}`, data).then(normalizeChipFilter),
  update: (filterId: string, data: Partial<ChipFilter>) =>
    apiPatch<BackendChipFilter>(`/chip-filters/${filterId}`, data).then(normalizeChipFilter),
  delete: (filterId: string) => apiDelete<void>(`/chip-filters/${filterId}`),
  reorder: (agentId: string, orderedIds: string[]) =>
    apiPost<BackendChipFilter[]>(`/chip-filters/agents/${agentId}/reorder`, { orderedIds }).then((filters) =>
      filters.map(normalizeChipFilter)
    ),
};

// Sources
export const sourcesApi = {
  list: () => apiGet<{ data: BackendSource[] }>('/sources?limit=100').then((res) => (res.data ?? []).map(normalizeSource)),
  create: (data: CreateSourceDto) => apiPost<BackendSource, CreateSourceDto>('/sources', data).then(normalizeSource),
  update: (id: string, data: UpdateSourceDto) => apiPut<BackendSource, UpdateSourceDto>(`/sources/${id}`, data).then(normalizeSource),
  delete: (id: string) => apiDelete<void>(`/sources/${id}`),
  test: (id: string) => apiPost<SourceTestResult>(`/sources/${id}/test`, {}),
  fetch: (id: string) => apiPost<{ operationId?: string; op_id?: string }>(`/sources/${id}/fetch`, {}).then((payload) => ({
    op_id: payload.op_id ?? payload.operationId ?? '',
  })),
};

// Articles
export const articlesApi = {
  list: (filters?: ArticleFilters, cursor?: string, limit = 20) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (cursor) params.set('cursor', cursor);
    if (filters?.agent_id) params.set('agentId', filters.agent_id);
    if (filters?.source_id) params.set('sourceId', filters.source_id);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.date_from) params.set('dateFrom', filters.date_from);
    if (filters?.date_to) params.set('dateTo', filters.date_to);
    if (filters?.favorites_only !== undefined) params.set('isFavorite', String(filters.favorites_only));
    if (filters?.sort_by) params.set('sortBy', filters.sort_by);
    if (filters?.sort_order) params.set('sortOrder', filters.sort_order);
    return apiGet<BackendCursorResponse<BackendArticle>>(`/articles?${params.toString()}`).then((payload) =>
      normalizeCursorResponse(payload, normalizeArticle)
    );
  },
  search: (q: string, cursor?: string, limit = 20, filters?: ArticleFilters) => {
    const params = new URLSearchParams();
    params.set('q', q);
    params.set('limit', String(limit));
    if (cursor) params.set('cursor', cursor);
    if (filters?.agent_id) params.set('agentId', filters.agent_id);
    if (filters?.source_id) params.set('sourceId', filters.source_id);
    if (filters?.favorites_only !== undefined) params.set('isFavorite', String(filters.favorites_only));
    return apiGet<BackendCursorResponse<BackendArticle>>(`/articles/search?${params.toString()}`).then((payload) =>
      normalizeCursorResponse(payload, normalizeArticle)
    );
  },
  selection: (filters?: ArticleFilters, maxIds = 200) => {
    const params = new URLSearchParams();
    params.set('maxIds', String(maxIds));
    if (filters?.agent_id) params.set('agentId', filters.agent_id);
    if (filters?.source_id) params.set('sourceId', filters.source_id);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.date_from) params.set('dateFrom', filters.date_from);
    if (filters?.date_to) params.set('dateTo', filters.date_to);
    if (filters?.favorites_only !== undefined) params.set('isFavorite', String(filters.favorites_only));
    if (filters?.sort_by) params.set('sortBy', filters.sort_by);
    if (filters?.sort_order) params.set('sortOrder', filters.sort_order);
    return apiGet<{
      articleIds?: string[];
      article_ids?: string[];
      selectedCount?: number;
      selected_count?: number;
      capped: boolean;
      maxIds?: number;
      max_ids?: number;
    }>(`/articles/selection?${params.toString()}`).then((payload) => ({
      article_ids: payload.article_ids ?? payload.articleIds ?? [],
      selected_count: payload.selected_count ?? payload.selectedCount ?? 0,
      capped: payload.capped,
      max_ids: payload.max_ids ?? payload.maxIds ?? maxIds,
    }));
  },
  get: (id: string) => apiGet<BackendArticle>(`/articles/${id}`).then(normalizeArticle),
  favorite: (id: string) => apiPost<BackendArticle, Record<string, never>>(`/articles/${id}/favorite`, {}).then(normalizeArticle),
  unfavorite: (id: string) => apiDelete<BackendArticle>(`/articles/${id}/favorite`).then(normalizeArticle),
  deleteAll: () => apiDelete<{ deleted: number }>('/articles'),
};

export const operationLogsApi = {
  list: (cursor?: string, limit = 8) =>
    apiGet<BackendCursorResponse<BackendOperationLog>>(`/operation-logs?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`).then((payload) =>
      normalizeCursorResponse(payload, normalizeOperationLog)
    ),
  cancel: (id: string) =>
    apiPatch<BackendOperationLog, { status: string }>(`/operation-logs/${id}`, { status: 'cancelled' }).then(normalizeOperationLog),
};

export const dashboardApi = {
  get: () =>
    apiGet<BackendDashboardSummary>('/dashboard').then((payload) => ({
      total_articles: Number(payload.total_articles ?? payload.totalArticles ?? 0),
      favorite_count: Number(payload.favorite_count ?? payload.favoriteCount ?? 0),
    })),
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
  generatePost: (data: GeneratePostDto) =>
    apiPost<{ operationId?: string; op_id?: string; status?: string; content?: string; error?: string }, {
      articleIds?: string[];
      templateId?: string;
      customPrompt?: string;
      agentId?: string;
      provider?: string;
      model?: string;
    }>('/generation/post', {
      articleIds: data.article_ids,
      templateId: data.template_id,
      customPrompt: data.custom_prompt,
      provider: data.provider,
      model: data.model,
    }).then(normalizeGenerationResult),
  generateDigest: (data: GenerateDigestDto) =>
    apiPost<{ operationId?: string; op_id?: string; status?: string; content?: string; error?: string }, {
      agentId?: string;
      articleIds?: string[];
      templateId?: string;
      customPrompt?: string;
      period?: 'day' | 'week' | 'month';
      articleCount?: number;
      provider?: string;
      model?: string;
    }>('/generation/digest', {
      agentId: data.agent_id,
      articleIds: data.article_ids,
      templateId: data.template_id,
      customPrompt: data.custom_prompt,
      period: data.period,
      articleCount: data.article_count,
      provider: data.provider,
      model: data.model,
    }).then(normalizeGenerationResult),
  stream: (
    opId: string,
    onState: (state: GenerationStreamState) => void,
    onError?: (error: Event) => void
  ) =>
    subscribeToSSE<{ status?: string; content?: string; chunks?: string[]; error?: string }>(
      `/generation/stream/${opId}`,
      (data) => {
        if (typeof data === 'string') {
          onState({ status: 'generating', content: data });
          return;
        }

        onState({
          status: (data?.status as GenerationStreamState['status']) ?? (data?.error ? 'error' : 'generating'),
          content: data?.content ?? '',
          error: data?.error,
        });
      },
      onError
    ),
  history: (cursor?: string, limit = 20) =>
    apiGet<BackendCursorResponse<BackendGeneratedPost>>(`/generation/posts?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`).then((payload) =>
      normalizeCursorResponse(payload, normalizeGeneratedPost)
    ),
  getPost: (id: string) =>
    apiGet<BackendGeneratedPost>(`/generation/posts/${id}`).then(normalizeGeneratedPost),
  updatePost: (id: string, content: string) =>
    apiPut<BackendGeneratedPost, { content: string }>(`/generation/posts/${id}`, { content }).then(normalizeGeneratedPost),
  deletePost: (id: string) => apiDelete<void>(`/generation/posts/${id}`),
};

export const deepsearchApi = {
  list: (cursor?: string, limit = 20) =>
    apiGet<BackendCursorResponse<BackendDeepSearchResult>>(`/deepsearch?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`).then((payload) =>
      normalizeCursorResponse(payload, normalizeDeepSearchResult)
    ),
  start: (data: StartDeepSearchDto) =>
    apiPost<{ operationId?: string; op_id?: string; resultId?: string; operationLogId?: string; status?: string; content?: string; error?: string }, {
      articleId: string;
      agentId?: string;
      customPrompt?: string;
    }>('/deepsearch', {
      articleId: data.article_id,
      agentId: data.agent_id,
      customPrompt: data.custom_prompt,
    }).then((payload): DeepSearchStartResult => ({
      ...normalizeGenerationResult(payload),
      result_id: payload.resultId ?? payload.operationId ?? payload.op_id,
      operation_log_id: payload.operationLogId,
    })),
  get: (id: string) => apiGet<BackendDeepSearchResult>(`/deepsearch/${id}`).then(normalizeDeepSearchResult),
  latestForArticle: (articleId: string) =>
    apiGet<BackendDeepSearchResult>(`/articles/${articleId}/deepsearch`).then(normalizeDeepSearchResult),
  delete: (id: string) => apiDelete<void>(`/deepsearch/${id}`),
  getWebSearchSettings: () => apiGet<DeepSearchWebSearchSettings>('/deepsearch/settings/web-search'),
  updateWebSearchSettings: (settings: DeepSearchWebSearchSettings) =>
    apiPut<DeepSearchWebSearchSettings, Partial<DeepSearchWebSearchSettings>>('/deepsearch/settings/web-search', settings),
  testWebSearchSettings: (settings: Partial<DeepSearchWebSearchSettings> & { query?: string }) =>
    apiPost<DeepSearchWebSearchTestResult, Partial<DeepSearchWebSearchSettings> & { query?: string }>('/deepsearch/settings/web-search/test', settings),
};

// Scoring (workspace-level defaults)
export const scoringApi = {
  getConfig: () => apiGet<ScoringConfig>('/scoring/config'),
  updateConfig: (config: ScoringConfig) => apiPut<ScoringConfig, ScoringConfig>('/scoring/config', config),
  getStats: () => apiGet<ScoringConfig & { distribution?: Record<string, number>; totalArticles?: number }>('/scoring/stats'),
  recalculate: (agentId?: string) => apiPost<{ articlesQueued: number }>('/scoring/recalculate', agentId ? { agentId } : {}),
};

export const assetPacksApi = {
  list: () => apiGet<AssetPack[]>('/asset-packs'),
  create: (data: { name: string; description?: string; emojis: string | string[]; setDefault?: boolean }) =>
    apiPost<AssetPack>('/asset-packs', data),
  setDefault: (packId: string) => apiPost<AssetPack>('/asset-packs/default', { packId }),
};

// ─── Subscription API ────────────────────────────────────────

export const subscriptionApi = {
  get: () => apiGet<Subscription>('/subscription'),
  getLimits: () => apiGet<SubscriptionLimits>('/subscription/limits'),
  getPayments: () => apiGet<Payment[]>('/subscription/payments'),
  create: () => apiPost<CreatePaymentResponse>('/subscription/create', {}),
  cancel: () => apiPost<void>('/subscription/cancel', {}),
};

// ─── iBoard API ──────────────────────────────────────────────

export const iboardApi = {
  stats: () => apiGet<IBoardStats>('/iboard/stats'),
  timeline: () => apiGet<TimelinePoint[]>('/iboard/timeline'),
  leaderboard: () => apiGet<LeaderboardArticle[]>('/iboard/leaderboard'),
  sourcesHealth: () => apiGet<SourceHealth[]>('/iboard/sources-health'),
};

// ─── Workspace Config API (custom prompts etc) ──────────────

export interface WorkspaceConfig {
  prompts?: {
    search?: string;
    deepsearch?: string;
    scoring?: string;
    post_generation?: string;
    digest_generation?: string;
  };
  telegram?: {
    stickerPacks?: string[];
  };
  generation?: {
    provider?: string;
    model?: string;
    postTemplateId?: string | null;
    digestTemplateId?: string | null;
    period?: 'day' | 'week' | 'month';
  };
  deepsearchWebSearch?: {
    provider?: DeepSearchWebSearchProvider;
    hasApiKey?: boolean;
    baseUrl?: string;
    model?: string;
    maxResults?: number;
  };
  [key: string]: unknown;
}

export interface AssetPackItem {
  id: string;
  type: string;
  name: string;
  value: string;
  label?: string | null;
  position: number;
}

export interface AssetPack {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  itemCount: number;
  items: AssetPackItem[];
}

export const workspaceApi = {
  get: () => apiGet<{ id: string; name: string; plan: string; config: WorkspaceConfig }>('/workspaces/me'),
  updateConfig: (config: WorkspaceConfig) => apiPatch<{ id: string; name: string; plan: string; config: WorkspaceConfig }, { config: WorkspaceConfig }>('/workspaces/me', { config }),
};

// ─── Notifications API ───────────────────────────────────────

export const notificationsApi = {
  list: () => apiGet<{ data: Notification[] }>('/notifications').then((res) => res.data ?? []),
  markRead: (id: string) => apiPost<void>(`/notifications/${id}/read`, {}),
  markAllRead: () => apiPost<void>('/notifications/read-all', {}),
};
