import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Skeleton } from '@shared/ui/skeleton';
import { Input } from '@shared/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/tabs';
import { useAgentsStore } from '@shared/stores/agents-store';
import { useSourcesStore } from '@shared/stores/sources-store';
import { useToast } from '@shared/ui/toast';
import { AgentForm } from './agent-form';
import {
  ArrowLeft,
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
} from 'lucide-react';
import { cn } from '@shared/lib/utils';
import type { CreateAgentDto, UpdateAgentDto, AgentStats } from '@shared/api/client';
import { agentsApi, sourcesApi } from '@shared/api/client';

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
  default: 'bg-accent-light text-accent',
};

interface AgentDetailPageProps {
  agentId: string;
}

export function AgentDetailPage({ agentId: id }: AgentDetailPageProps) {
  const navigate = useNavigate();
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

  useEffect(() => {
    if (id) {
      fetchAgent(id);
      fetchSourcesByAgent(id);
      loadStats(id);
    }
  }, [id, fetchAgent, fetchSourcesByAgent]);

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
    setUnlinkSourceId(sourceId);
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

  const colorClass = colorMap[currentAgent.color] || colorMap.default;

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
        <div className={cn('flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl', colorClass)}>
          <Bot className="h-6 w-6 sm:h-7 sm:w-7" />
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
                <Button variant="outline" size="sm" onClick={() => setAddSourceOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить источник
                </Button>
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
                    <Card key={source.id} className="hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{source.name}</p>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {source.type === 'rss' ? 'RSS' : 'Telegram'}
                            </Badge>
                            <Badge variant={source.is_active ? 'success' : 'default'} className="text-[10px] shrink-0">
                              {source.is_active ? 'Активен' : 'Отключен'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{source.url}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleUnlinkSource(source.id)}
                          disabled={unlinkingSourceId === source.id}
                          title="Отвязать от агента"
                          className="shrink-0"
                        >
                          <Unlink className="h-4 w-4 text-muted-foreground hover:text-danger" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="articles" className="mt-4">
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <Newspaper className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Просмотр новостей этого агента</p>
              <Button
                onClick={() => navigate({
                  to: '/feed/$agentId',
                  params: { agentId: currentAgent.id },
                })}
              >
                <Newspaper className="h-4 w-4 mr-2" />
                Открыть ленту
              </Button>
            </CardContent>
          </Card>
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
    </div>
  );
}
