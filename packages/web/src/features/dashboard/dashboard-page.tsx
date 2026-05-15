import { useState, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@shared/stores/auth-store';
import { useAgentsStore } from '@shared/stores/agents-store';
import { articlesApi, operationLogsApi } from '@shared/api/client';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Skeleton } from '@shared/ui/skeleton';
import { AgentCollectDialog } from '@/features/agents/agent-collect-dialog';
import { useToast } from '@shared/ui/toast';
import {
  Plus,
  Bot,
  Bookmark,
  ArrowRight,
  Newspaper,
  TrendingUp,
  Zap,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import type { Article, OperationLog } from '@shared/api/client';

export function DashboardPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuthStore();
  const {
    agents,
    isLoading: agentsLoading,
    fetchAgents,
    collectAgent,
  } = useAgentsStore();

  const [favorites, setFavorites] = useState<Article[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [operationLogsLoading, setOperationLogsLoading] = useState(true);
  const [operationLogsError, setOperationLogsError] = useState<string | null>(null);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);
  const [collectDialogOpen, setCollectDialogOpen] = useState(false);

  useEffect(() => {
    fetchAgents();
    loadFavorites();
    loadOperationLogs();
  }, [fetchAgents]);

  const loadFavorites = async () => {
    setFavoritesLoading(true);
    try {
      const response = await articlesApi.list({ favorites_only: true }, undefined, 5);
      setFavorites(response.data);
      setFavoritesCount(response.data.length);
    } catch {
      setFavorites([]);
    } finally {
      setFavoritesLoading(false);
    }
  };

  const loadOperationLogs = async () => {
    setOperationLogsLoading(true);
    setOperationLogsError(null);
    try {
      const response = await operationLogsApi.list(undefined, 6);
      setOperationLogs(response.data);
    } catch (err) {
      setOperationLogs([]);
      setOperationLogsError(err instanceof Error ? err.message : 'Не удалось загрузить журнал');
    } finally {
      setOperationLogsLoading(false);
    }
  };

  const handleCollect = async (agentId: string) => {
    try {
      const operationId = await collectAgent(agentId);
      addToast({ title: 'Сбор запущен', description: 'Агент собирает новости', variant: 'success' });
      void loadOperationLogs();
      return operationId;
    } catch {
      // Error handled by store
      return '';
    }
  };

  const handleDeleteAllArticles = async () => {
    const confirmed = window.confirm('Удалить все новости в текущем рабочем пространстве? Действие нельзя отменить.');
    if (!confirmed) return;

    setDeleteAllLoading(true);
    try {
      const result = await articlesApi.deleteAll();
      addToast({ title: 'Новости удалены', description: `Удалено: ${result.deleted}`, variant: 'success' });
      await Promise.all([fetchAgents(), loadFavorites(), loadOperationLogs()]);
    } catch (err) {
      addToast({
        title: 'Не удалось удалить новости',
        description: err instanceof Error ? err.message : 'Попробуй ещё раз',
        variant: 'danger',
      });
    } finally {
      setDeleteAllLoading(false);
    }
  };

  const activeAgents = agents.filter((a) => a.is_active);

  // Stats
  const stats = {
    agents: agents.length,
    articles: agents.reduce((acc, a) => acc + (a.article_count ?? 0), 0),
    generations: 0, // Placeholder - would need dedicated endpoint
    favorites: favoritesCount,
  };

  return (
    <div className="space-y-6">
      {/* Header: Welcome */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Привет, {user?.name?.split(' ')[0] || 'пользователь'}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Вот что произошло сегодня
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="danger" onClick={handleDeleteAllArticles} loading={deleteAllLoading}>
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Удалить все новости</span>
          </Button>
          <Button onClick={() => setCollectDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Собрать новости</span>
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light text-accent">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.agents}</p>
                <p className="text-xs text-muted-foreground">Агента</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-light text-success">
                <Newspaper className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.articles}</p>
                <p className="text-xs text-muted-foreground">Новостей</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-light text-warning">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.generations}</p>
                <p className="text-xs text-muted-foreground">Генераций</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger-light text-danger">
                <Bookmark className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.favorites}</p>
                <p className="text-xs text-muted-foreground">В избранном</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agents list */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Агенты сбора</CardTitle>
                  <CardDescription>Активные агенты мониторинга</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/agents' })}>
                  Все
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {agentsLoading && agents.length === 0 ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))
              ) : agents.length === 0 ? (
                <div className="flex flex-col items-center py-8">
                  <Bot className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">Нет агентов</p>
                  <Button size="sm" onClick={() => navigate({ to: '/agents' })}>
                    <Plus className="h-4 w-4" />
                    Создать агента
                  </Button>
                </div>
              ) : (
                agents.slice(0, 5).map((agent) => (
                  <Link
                    key={agent.id}
                    to="/agents/$id"
                    params={{ id: agent.id }}
                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light text-accent">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.article_count ?? 0} новостей
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={agent.is_active ? 'success' : 'default'}
                      >
                        {agent.is_active ? 'Активен' : 'Пауза'}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent activity - now real from previous PR */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Последние операции</CardTitle>
              <CardDescription>История последних действий</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {operationLogsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))
              ) : operationLogsError ? (
                <p className="rounded-lg border border-danger/30 bg-danger-light p-3 text-sm text-danger">
                  {operationLogsError}
                </p>
              ) : operationLogs.length === 0 ? (
                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  Журнал пока пуст
                </p>
              ) : (
                operationLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{log.message || log.operation_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={log.status === 'success' ? 'success' : log.status === 'failed' ? 'danger' : 'default'}>
                      {log.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - removed duplicate collect card */}
        <div className="space-y-6">
          {/* Bookmarks */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Избранное</CardTitle>
                  <CardDescription>Сохранённые материалы</CardDescription>
                </div>
                <Bookmark className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {favoritesLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))
              ) : favorites.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Нет избранных материалов
                </p>
              ) : (
                favorites.map((item) => (
                  <Link
                    key={item.id}
                    to="/feed/article/$id"
                    params={{ id: item.id }}
                    className="group block cursor-pointer rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium leading-snug group-hover:text-accent transition-colors line-clamp-2">
                      {item.title}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">
                        {item.source_name}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.published_at).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </Link>
                ))
              )}
              <Button
                variant="ghost"
                className="w-full text-sm"
                size="sm"
                onClick={() => navigate({ to: '/feed', search: { favorites: '1' } })}
              >
                Все закладки
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Collect Dialog */}
      <AgentCollectDialog
        agents={activeAgents}
        open={collectDialogOpen}
        onOpenChange={setCollectDialogOpen}
        onCollect={handleCollect}
      />
    </div>
  );
}
