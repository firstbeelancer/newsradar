import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@shared/stores/auth-store';
import { useAgentsStore } from '@shared/stores/agents-store';
import { articlesApi, dashboardApi, operationLogsApi, scoringApi, type Article, type OperationLog } from '@shared/api/client';
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
  Shield,
  Brain,
  Megaphone,
  Heart,
  Paintbrush,
  Globe,
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
  RotateCcw,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';

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

export function DashboardPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuthStore();
  const { agents, isLoading: agentsLoading, fetchAgents, collectAgent, collectAllAgents } = useAgentsStore();

  const [favorites, setFavorites] = useState<Article[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [totalArticles, setTotalArticles] = useState(0);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [operationLogsLoading, setOperationLogsLoading] = useState(true);
  const [operationLogsError, setOperationLogsError] = useState<string | null>(null);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);
  const [rescoreLoading, setRescoreLoading] = useState(false);
  const [collectDialogOpen, setCollectDialogOpen] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  useEffect(() => {
    void fetchAgents();
    void loadDashboardSummary();
    void loadFavorites();
    void loadOperationLogs();
  }, [fetchAgents]);

  // Quietly refresh data in the background every 30 seconds so cards stay current.
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchAgents();
      void loadDashboardSummary();
      void loadFavorites();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  // Remember when the user last triggered a manual refresh button.
  const handleManualRefresh = async () => {
    await refreshDashboard();
    setLastRefreshedAt(new Date());
  };

  function formatRefreshLabel(d: Date | null): string {
    if (!d) return 'ещё не обновляли';
    const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (seconds < 5) return 'только что';
    if (seconds < 60) return `${seconds} сек назад`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} мин назад`;
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  const loadDashboardSummary = async () => {
    try {
      const summary = await dashboardApi.get();
      setTotalArticles(summary.total_articles);
      setFavoritesCount(summary.favorite_count);
    } catch {
      setTotalArticles(0);
    }
  };

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

  const handleCollect = async (agentId: string | null) => {
    try {
      const operationId = agentId ? await collectAgent(agentId) : await collectAllAgents();
      addToast({
        title: 'Сбор запущен',
        description: agentId ? 'Агент собирает новости' : 'Все активные агенты собирают новости',
        variant: 'success',
      });
      void loadOperationLogs();
      return operationId;
    } catch {
      return '';
    }
  };

  const refreshDashboard = async () => {
    await Promise.all([fetchAgents(), loadDashboardSummary(), loadFavorites(), loadOperationLogs()]);
  };

  const handleDeleteAllArticles = async () => {
    const confirmed = window.confirm('Удалить все новости в текущем рабочем пространстве? Действие нельзя отменить.');
    if (!confirmed) return;

    setDeleteAllLoading(true);
    try {
      const result = await articlesApi.deleteAll();
      addToast({ title: 'Новости удалены', description: `Удалено: ${result.deleted}`, variant: 'success' });
      await refreshDashboard();
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

  const handleRescore = async () => {
    setRescoreLoading(true);
    try {
      const result = await scoringApi.recalculate();
      addToast({
        title: 'Рескоринг запущен',
        description: `В очередь поставлено ${result.articlesQueued} статей`,
        variant: 'success',
      });
      await loadOperationLogs();
    } catch (err) {
      addToast({
        title: 'Не удалось запустить рескоринг',
        description: err instanceof Error ? err.message : 'Попробуй ещё раз',
        variant: 'danger',
      });
    } finally {
      setRescoreLoading(false);
    }
  };

  const activeAgents = agents.filter((agent) => agent.is_active);
  const stats = {
    agents: agents.length,
    articles: totalArticles,
    generations: 0,
    favorites: favoritesCount,
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div className="flex min-w-0 flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Привет, {user?.name?.split(' ')[0] || 'пользователь'}!
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Вот что произошло сегодня</span>
            <button
              type="button"
              onClick={handleManualRefresh}
              title="Обновить данные"
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-white/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-cyan-200 hover:text-accent"
            >
              <RefreshCw className="h-3 w-3" />
              {formatRefreshLabel(lastRefreshedAt)}
            </button>
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <Button variant="danger" size="sm" onClick={handleDeleteAllArticles} loading={deleteAllLoading} className="min-w-0 justify-center px-2 sm:px-3">
            <Trash2 className="h-4 w-4" />
            <span>Удалить</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleRescore} loading={rescoreLoading} className="min-w-0 justify-center px-2 sm:px-3">
            <RotateCcw className="h-4 w-4" />
            <span>Рескор</span>
          </Button>
          <Button size="sm" onClick={() => setCollectDialogOpen(true)} className="min-w-0 justify-center px-2 sm:px-3">
            <Plus className="h-4 w-4" />
            <span>Собрать</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light text-accent">
                <Bot className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold leading-none tabular-nums">{stats.agents}</p>
              <p className="text-xs text-muted-foreground">Агента</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-light text-success">
                <Newspaper className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold leading-none tabular-nums">{stats.articles}</p>
              <p className="text-xs text-muted-foreground">Новостей</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-light text-warning">
                <Zap className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold leading-none tabular-nums">{stats.generations}</p>
              <p className="text-xs text-muted-foreground">Генераций</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger-light text-danger">
                <Bookmark className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold leading-none tabular-nums">{stats.favorites}</p>
              <p className="text-xs text-muted-foreground">В избранном</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg">Агенты сбора</CardTitle>
                  <CardDescription>Активные агенты мониторинга</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/agents' })} className="shrink-0">
                  Все
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {agentsLoading && agents.length === 0 ? (
                Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16" />)
              ) : agents.length === 0 ? (
                <div className="flex flex-col items-center py-8">
                  <Bot className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="mb-4 text-sm text-muted-foreground">Нет агентов</p>
                  <Button size="sm" onClick={() => navigate({ to: '/agents' })}>
                    <Plus className="h-4 w-4" />
                    Создать агента
                  </Button>
                </div>
              ) : (
                agents.slice(0, 5).map((agent) => {
                  const AgentIcon = getAgentIcon(agent.icon);

                  return (
                    <Link
                      key={agent.id}
                      to="/agents/$id"
                      params={{ id: agent.id }}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: agent.color ? `${agent.color}18` : undefined, color: agent.color || undefined }}
                        >
                          <AgentIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.article_count ?? 0} новостей</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge variant={agent.is_active ? 'success' : 'default'}>
                          {agent.is_active ? 'Активен' : 'Пауза'}
                        </Badge>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Последние операции</CardTitle>
              <CardDescription>История последних действий</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {operationLogsLoading ? (
                Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14" />)
              ) : operationLogsError ? (
                <p className="rounded-lg border border-danger/30 bg-danger-light p-3 text-sm text-danger">
                  {operationLogsError}
                </p>
              ) : operationLogs.length === 0 ? (
                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Журнал пока пуст</p>
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
                    <Badge
                      variant={log.status === 'success' ? 'success' : log.status === 'failed' ? 'danger' : 'default'}
                      className="shrink-0"
                    >
                      {log.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg">Избранное</CardTitle>
                  <CardDescription>Сохранённые материалы</CardDescription>
                </div>
                <Bookmark className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {favoritesLoading ? (
                Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-16" />)
              ) : favorites.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Нет избранных материалов</p>
              ) : (
                favorites.map((item) => (
                  <Link
                    key={item.id}
                    to="/feed/article/$id"
                    params={{ id: item.id }}
                    className="group block cursor-pointer rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <p className="line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-accent">
                      {item.title}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {item.source_name}
                      </Badge>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
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

      <AgentCollectDialog
        agents={activeAgents}
        open={collectDialogOpen}
        onOpenChange={setCollectDialogOpen}
        onCollect={handleCollect}
      />
    </div>
  );
}
