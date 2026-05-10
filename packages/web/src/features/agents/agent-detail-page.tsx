import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Skeleton } from '@shared/ui/skeleton';
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
} from 'lucide-react';
import { cn } from '@shared/lib/utils';
import type { CreateAgentDto, UpdateAgentDto, AgentStats } from '@shared/api/client';
import { agentsApi } from '@shared/api/client';

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
  default: 'bg-accent-light text-accent',
};

export function AgentDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
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
      <div className="flex items-start gap-4">
        <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', colorClass)}>
          <Bot className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{currentAgent.name}</h1>
            <Badge variant={currentAgent.is_active ? 'success' : 'default'}>
              {currentAgent.is_active ? 'Активен' : 'Пауза'}
            </Badge>
          </div>
          {currentAgent.description && (
            <p className="text-sm text-muted-foreground mt-1">{currentAgent.description}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleCollect}>
            <Play className="h-4 w-4" />
            Собрать
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
                <p className="text-2xl font-bold">{stats?.total_articles ?? 0}</p>
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
                <p className="text-2xl font-bold">{stats?.total_sources ?? 0}</p>
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
                <p className="text-2xl font-bold">{stats?.avg_articles_per_day ?? 0}</p>
                <p className="text-xs text-muted-foreground">В день</p>
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
          ) : sources.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <Link2 className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Нет источников</p>
                <Button variant="link" size="sm" onClick={() => navigate({ to: '/sources' })}>
                  Перейти к источникам
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {sources.map((source) => (
                <Card key={source.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{source.name}</p>
                      <p className="text-xs text-muted-foreground">{source.url}</p>
                    </div>
                    <Badge variant={source.is_active ? 'success' : 'default'}>
                      {source.is_active ? 'Активен' : 'Отключен'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="articles" className="mt-4">
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <Newspaper className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Просмотр новостей этого агента</p>
              <Button asChild>
                <Link to="/feed/$agentId" params={{ agentId: currentAgent.id }}>
                  <Newspaper className="h-4 w-4 mr-2" />
                  Открыть ленту
                </Link>
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
                    <span className="text-sm font-medium">{stats.total_articles}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Всего источников</span>
                    <span className="text-sm font-medium">{stats.total_sources}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Среднее в день</span>
                    <span className="text-sm font-medium">{stats.avg_articles_per_day}</span>
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
