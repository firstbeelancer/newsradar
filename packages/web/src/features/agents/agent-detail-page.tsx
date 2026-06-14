import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Skeleton } from '@shared/ui/skeleton';
import { Input } from '@shared/ui/input';
import { Switch } from '@shared/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/tabs';
import { useAgentsStore } from '@shared/stores/agents-store';
import { useSourcesStore } from '@shared/stores/sources-store';
import { useToast } from '@shared/ui/toast';
import { AgentForm } from './agent-form';
import { SourceForm } from '../sources/source-form';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Pencil,
  Play,
  Newspaper,
  Link2,
  BarChart3,
  CircleDot,
  Plus,
  Trash2,
  Unlink,
  X,
  Filter,
  Shield,
  Brain,
  Megaphone,
  Heart,
  Paintbrush,
  Globe,
  Zap,
  Star,
  Eye,
  Search,
  BookOpen,
  Rss,
  MessageCircle,
  Target,
  Lightbulb,
  Compass,
  Hammer,
  Wrench,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Loader2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cleanArticleText } from '@shared/lib/utils';

// Map agent.icon string to Lucide icon component
const ICON_MAP: Record<string, LucideIcon> = {
  bot: Bot,
  shield: Shield,
  brain: Brain,
  megaphone: Megaphone,
  heart: Heart,
  paintbrush: Paintbrush,
  globe: Globe,
  zap: Zap,
  star: Star,
  eye: Eye,
  search: Search,
  book: BookOpen,
  bookopen: BookOpen,
  rss: Rss,
  message: MessageCircle,
  messagecircle: MessageCircle,
  target: Target,
  lightbulb: Lightbulb,
  compass: Compass,
  newspaper: Newspaper,
  hammer: Hammer,
  wrench: Wrench,
};

function getAgentIcon(iconStr?: string): LucideIcon {
  if (!iconStr) return Bot;
  const key = iconStr.toLowerCase().replace(/[^a-z]/g, '');
  return ICON_MAP[key] || Bot;
}
import type { CreateAgentDto, UpdateAgentDto, AgentStats, ChipFilter } from '@shared/api/client';
import { agentsApi, sourcesApi, chipFiltersApi, articlesApi, type Article, type Source, type UpdateSourceDto } from '@shared/api/client';
import { useGenerationStore } from '@shared/stores/generation-store';

// ─── Inline articles list for agent detail ───────────────────────────────────

function AgentArticlesList({ agentId }: { agentId: string }) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'date' | 'score'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { setGenerationType, setSelectedAgentId, setSelectedArticles, resetGeneration } = useGenerationStore();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['agent-articles', agentId, sortBy, sortOrder],
    queryFn: async ({ pageParam }) => {
      return articlesApi.list(
        { agent_id: agentId, sort_by: sortBy, sort_order: sortOrder },
        pageParam as string | undefined,
        20
      );
    },
    getNextPageParam: (lastPage) => {
      return lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined;
    },
    initialPageParam: undefined as string | undefined,
    staleTime: 30_000,
  });

  const articles: Article[] = data?.pages.flatMap((page) => page.data) ?? [];

  const handleGeneratePost = useCallback((article: Article) => {
    resetGeneration();
    setGenerationType('post');
    setSelectedAgentId(article.agent_id || agentId);
    setSelectedArticles([article]);
    navigate({ to: '/generation' });
  }, [agentId, navigate, resetGeneration, setGenerationType, setSelectedAgentId, setSelectedArticles]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12">
          <Newspaper className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Нет новостей для этого агента</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({
              to: '/feed/$agentId',
              params: { agentId },
            })}
          >
            Открыть ленту
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={sortBy === 'date' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            if (sortBy === 'date') {
              setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
            } else {
              setSortBy('date');
              setSortOrder('desc');
            }
          }}
        >
          {sortOrder === 'desc' && sortBy === 'date' ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpWideNarrow className="h-4 w-4" />}
          {sortBy === 'date' && sortOrder === 'desc' ? 'Сначала новые' : sortBy === 'date' && sortOrder === 'asc' ? 'Сначала старые' : 'По дате'}
        </Button>
        <Button
          type="button"
          variant={sortBy === 'score' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            if (sortBy === 'score') {
              setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
            } else {
              setSortBy('score');
              setSortOrder('desc');
            }
          }}
        >
          {sortOrder === 'desc' && sortBy === 'score' ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpWideNarrow className="h-4 w-4" />}
          {sortBy === 'score' && sortOrder === 'desc' ? 'Сначала высокий скор' : sortBy === 'score' && sortOrder === 'asc' ? 'Сначала низкий скор' : 'По скору'}
        </Button>
      </div>
      {articles.map((article) => (
        <Card
          key={article.id}
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => navigate({ to: '/feed/article/$id', params: { id: article.id } })}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug line-clamp-2">{article.title}</p>
                {cleanArticleText(article.description || article.ai_summary || article.content || article.original_description || '') && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {cleanArticleText(article.description || article.ai_summary || article.content || article.original_description || '')}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="font-medium">{article.source_name}</span>
                  <span>
                    {new Date(article.published_at).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0 items-end">
                <Badge className="shrink-0 text-[10px]">
                  {Math.round(article.score)}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGeneratePost(article);
                  }}
                  className="text-accent border-accent/30 hover:bg-accent/10 gap-1 text-xs h-7"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Генерация
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        {hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5 mr-1" />}
            Загрузить ещё
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/feed/$agentId', params: { agentId } })}
        >
          Все новости агента
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

interface AgentDetailPageProps {
  agentId: string;
}

export function AgentDetailPage({ agentId: id }: AgentDetailPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const {
    currentAgent,
    isLoading: agentLoading,
    isSubmitting,
    fetchAgent,
    updateAgent,
    collectAgent,
  } = useAgentsStore();

  const {
    sources,
    isLoading: sourcesLoading,
    fetchSourcesByAgent,
    updateSource: updateSourceInStore,
  } = useSourcesStore();

  const [formOpen, setFormOpen] = useState(false);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState<'rss' | 'telegram'>('rss');
  const [addingSource, setAddingSource] = useState(false);
  const [unlinkingSourceId, setUnlinkingSourceId] = useState<string | null>(null);
  const [togglingSourceId, setTogglingSourceId] = useState<string | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [savingSourceEdit, setSavingSourceEdit] = useState(false);
  const [deletingAgentArticles, setDeletingAgentArticles] = useState(false);
  const [chipFilters, setChipFilters] = useState<ChipFilter[]>([]);

  useEffect(() => {
    if (id) {
      fetchAgent(id);
      fetchSourcesByAgent(id);
      loadStats(id);
      loadChipFilters(id);
    }
  }, [id, fetchAgent, fetchSourcesByAgent]);

  const loadChipFilters = async (agentId: string) => {
    try {
      const filters = await chipFiltersApi.list(agentId);
      setChipFilters(filters);
    } catch {
      setChipFilters([]);
    }
  };

  const loadStats = async (agentId: string) => {
    setStatsLoading(true);
    try {
      const data = await agentsApi.stats(agentId);
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleUpdate = async (data: CreateAgentDto | UpdateAgentDto) => {
    if (!id) return;
    try {
      await updateAgent(id, data as UpdateAgentDto);
      addToast({ title: 'Сохранено', description: 'Агент обновлен', variant: 'success' });
    } catch {
      // Error handled by store
    }
  };

  const handleCollect = async () => {
    if (!id) return;
    try {
      await collectAgent(id);
      addToast({ title: 'Сбор запущен', description: 'Агент собирает новости', variant: 'success' });
    } catch {
      // Error handled by store
    }
  };

  const handleDeleteAgentArticles = async () => {
    if (!id || !currentAgent) return;
    const confirmed = window.confirm(`Удалить все новости агента «${currentAgent.name}»? Действие нельзя отменить.`);
    if (!confirmed) return;

    setDeletingAgentArticles(true);
    try {
      const result = await articlesApi.deleteByAgent(id);
      addToast({ title: 'Новости агента удалены', description: `Удалено: ${result.deleted}`, variant: 'success' });
      await Promise.all([
        loadStats(id),
        fetchSourcesByAgent(id),
        queryClient.invalidateQueries({ queryKey: ['agent-articles', id] }),
      ]);
    } catch (err) {
      addToast({
        title: 'Не удалось удалить новости агента',
        description: err instanceof Error ? err.message : 'Попробуй ещё раз',
        variant: 'danger',
      });
    } finally {
      setDeletingAgentArticles(false);
    }
  };

  const handleAddSource = async () => {
    if (!id || !newSourceName.trim() || !newSourceUrl.trim()) return;
    setAddingSource(true);
    try {
      // Create source
      const source = await sourcesApi.create({
        agent_id: id,
        name: newSourceName.trim(),
        url: newSourceUrl.trim(),
        type: newSourceType,
      });
      // Link source to agent
      await agentsApi.linkSource(id, source.id);
      addToast({ title: 'Источник добавлен', description: newSourceName.trim(), variant: 'success' });
      setNewSourceName('');
      setNewSourceUrl('');
      setAddSourceOpen(false);
      fetchSourcesByAgent(id);
    } catch (err) {
      addToast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось добавить источник',
        variant: 'danger',
      });
    } finally {
      setAddingSource(false);
    }
  };

  const handleUnlinkSource = async (sourceId: string) => {
    if (!id) return;
    setUnlinkingSourceId(sourceId);
    try {
      await agentsApi.unlinkSource(id, sourceId);
      addToast({ title: 'Источник отвязан', variant: 'success' });
      fetchSourcesByAgent(id);
    } catch (err) {
      addToast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось отвязать источник',
        variant: 'danger',
      });
    } finally {
      setUnlinkingSourceId(null);
    }
  };

  const handleToggleSource = async (sourceId: string, nextActive: boolean) => {
    setTogglingSourceId(sourceId);
    try {
      await updateSourceInStore(sourceId, { isActive: nextActive });
    } catch {
      // Error handled by store
    } finally {
      setTogglingSourceId(null);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    setDeletingSourceId(sourceId);
    try {
      await sourcesApi.delete(sourceId);
      addToast({ title: 'Источник удалён', variant: 'success' });
      if (id) {
        fetchSourcesByAgent(id);
        loadStats(id);
      }
    } catch (err) {
      addToast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось удалить источник',
        variant: 'danger',
      });
    } finally {
      setDeletingSourceId(null);
    }
  };

  const handleEditSource = async (data: UpdateSourceDto) => {
    if (!editingSource || !id) return;
    setSavingSourceEdit(true);
    try {
      await updateSourceInStore(editingSource.id, data);
      addToast({ title: 'Источник сохранён', description: editingSource.name, variant: 'success' });
      setEditingSource(null);
      fetchSourcesByAgent(id);
    } catch (err) {
      addToast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось обновить источник',
        variant: 'danger',
      });
    } finally {
      setSavingSourceEdit(false);
    }
  };

  if (agentLoading && !currentAgent) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!currentAgent) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground">Агент не найден</p>
        <Button variant="ghost" onClick={() => navigate({ to: '/agents' })} className="mt-4">
          <ArrowLeft className="h-4 w-4" />
          Назад к списку
        </Button>
      </div>
    );
  }

  const agentColor = currentAgent.color || '#0ea5e9';
  const isHex = agentColor.startsWith('#');
  const AgentIcon = getAgentIcon(currentAgent.icon);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: '/agents' })}
        className="-ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Агенты
      </Button>

      {/* Agent header */}
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl"
          style={isHex ? { backgroundColor: `${agentColor}18`, color: agentColor } : { backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
        >
          <AgentIcon className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold truncate">{currentAgent.name}</h1>
            <Badge variant={currentAgent.is_active ? 'success' : 'default'} className="shrink-0">
              {currentAgent.is_active ? 'Активен' : 'Пауза'}
            </Badge>
          </div>
          {currentAgent.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{currentAgent.description}</p>
          )}
        </div>
        <div className="flex gap-1.5 sm:gap-2 shrink-0">
          <Button variant="danger" size="sm" onClick={handleDeleteAgentArticles} loading={deletingAgentArticles}>
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Удалить новости</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleCollect}>
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Собрать</span>
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light text-accent">
                <Newspaper className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.articleCount ?? stats?.total_articles ?? 0}</p>
                <p className="text-xs text-muted-foreground">Новостей</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.sourceCount ?? stats?.total_sources ?? 0}</p>
                <p className="text-xs text-muted-foreground">Источников</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-light text-warning">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.todayCount ?? stats?.avg_articles_per_day ?? 0}</p>
                <p className="text-xs text-muted-foreground">Сегодня</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-light text-success">
                <CircleDot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.last_collection_at
                    ? new Date(stats.last_collection_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Последний сбор</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chip Filters */}
      {chipFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {chipFilters.filter(cf => cf.isActive).map((cf) => (
            <span
              key={cf.id}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border border-border/60 bg-muted/40 text-muted-foreground"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: cf.color && cf.color !== 'default' ? cf.color : '#94a3b8' }}
              />
              {cf.label}
              {cf.scoreModifier !== 0 && (
                <span className={cf.scoreModifier > 0 ? 'text-green-600' : 'text-red-600'}>
                  {cf.scoreModifier > 0 ? '+' : ''}{(cf.scoreModifier * 100).toFixed(0)}%
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">
            <Link2 className="h-4 w-4 mr-1.5" />
            Источники ({sources.length})
          </TabsTrigger>
          <TabsTrigger value="articles">
            <Newspaper className="h-4 w-4 mr-1.5" />
            Новости
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Статистика
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-4">
          {sourcesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Add source button */}
              {addSourceOpen ? (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Новый источник</p>
                      <Button variant="ghost" size="icon-sm" onClick={() => setAddSourceOpen(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        placeholder="Название"
                        value={newSourceName}
                        onChange={(e) => setNewSourceName(e.target.value)}
                      />
                      <select
                        value={newSourceType}
                        onChange={(e) => setNewSourceType(e.target.value as 'rss' | 'telegram')}
                        className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                      >
                        <option value="rss">RSS</option>
                        <option value="telegram">Telegram</option>
                      </select>
                    </div>
                    <Input
                      placeholder={newSourceType === 'rss' ? 'https://example.com/feed' : 'https://t.me/channel'}
                      value={newSourceUrl}
                      onChange={(e) => setNewSourceUrl(e.target.value)}
                    />
                    <Button size="sm" onClick={handleAddSource} disabled={addingSource || !newSourceName.trim() || !newSourceUrl.trim()}>
                      <Plus className="h-4 w-4 mr-1" />
                      {addingSource ? 'Добавление...' : 'Добавить'}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAddSourceOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Новый источник
                  </Button>
                </div>
              )}

              {/* Sources list */}
              {sources.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center py-12">
                    <Link2 className="h-8 w-8 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Нет источников</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {sources.map((source) => (
                    <Card key={source.id} className="hover:bg-muted/50 transition-colors group/src">
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{source.name}</p>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {source.type === 'rss' ? 'RSS' : 'Telegram'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{source.url}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={source.is_active}
                            onCheckedChange={(checked) => handleToggleSource(source.id, checked)}
                            disabled={togglingSourceId === source.id}
                            className="scale-75"
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditingSource(source)}
                            title="Редактировать источник"
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground hover:text-accent" />
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSource(source.id)}
                            disabled={deletingSourceId === source.id}
                            className="opacity-100 sm:opacity-0 sm:group-hover/src:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Удалить источник"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleUnlinkSource(source.id)}
                            disabled={unlinkingSourceId === source.id}
                            title="Отвязать от агента"
                          >
                            <Unlink className="h-4 w-4 text-muted-foreground hover:text-danger" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="articles" className="mt-4">
          <AgentArticlesList agentId={currentAgent.id} />
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Статистика агента</CardTitle>
              <CardDescription>Общая статистика по сбору новостей</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {statsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              ) : stats ? (
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Всего новостей</span>
                    <span className="text-sm font-medium">{stats.articleCount ?? stats.total_articles ?? 0}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Всего источников</span>
                    <span className="text-sm font-medium">{stats.sourceCount ?? stats.total_sources ?? 0}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Сегодня</span>
                    <span className="text-sm font-medium">{stats.todayCount ?? stats.avg_articles_per_day ?? 0}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-muted-foreground">Последний сбор</span>
                    <span className="text-sm font-medium">
                      {stats.last_collection_at
                        ? new Date(stats.last_collection_at).toLocaleString('ru-RU')
                        : 'Нет данных'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Нет данных о статистике
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Form */}
      <AgentForm
        agent={currentAgent}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleUpdate}
        isSubmitting={isSubmitting}
      />
      <SourceForm
        source={editingSource}
        agents={[]}
        open={Boolean(editingSource)}
        onOpenChange={(open) => {
          if (!open) setEditingSource(null);
        }}
        onSubmit={(data) => handleEditSource(data as UpdateSourceDto)}
        isSubmitting={savingSourceEdit}
      />
    </div>
  );
}
