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
import { OperationLogRow } from '@/features/dashboard/operation-log-row';
import { useToast } from '@shared/ui/toast';
import { formatDateTime } from '@shared/lib/utils';
import {
  Plus,
  Bot,
  Bookmark,
  ArrowRight,
  Newspaper,
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
  const [sourceCount, setSourceCount] = useState(0);
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
      setSourceCount(summary.source_count);
    } catch {
      setTotalArticles(0);
      setSourceCount(0);
    }
  };

  const loadFavorites = async () => {
    setFavoritesLoading(true);
    try {
      const response = await articlesApi.list({ favorites_only: true }, undefined, 5);
      setFavorites(response.data);
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
    sources: sourceCount,
    favorites: favoritesCount,
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <section className="nr-hero rounded-3xl p-5 sm:p-6">
        <div className="relative z-10 flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/70 bg-white/70 px-3 py-1 text-[11px] font-semibold text-cyan-800 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              Рабочее пространство готово
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Привет, {user?.name?.split(' ')[0] || 'пользователь'}!
              </h1>
              <p className="mt-1.5 max-w-xl text-sm text-slate-600">
                Сводка дня: сбор, агенты и избранное — в одном спокойном экране.
              </p>
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              title="Обновить данные"
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-100 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-cyan-300 hover:text-accent"
            >
              <RefreshCw className="h-3 w-3" />
              {formatRefreshLabel(lastRefreshedAt)}
            </button>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            <Button variant="danger" size="sm" onClick={handleDeleteAllArticles} loading={deleteAllLoading} className="min-w-0 justify-center px-2 sm:px-3">
              <Trash2 className="h-4 w-4" />
              <span>Удалить</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleRescore} loading={rescoreLoading} className="min-w-0 justify-center border-white/70 bg-white/70 px-2 sm:px-3">
              <RotateCcw className="h-4 w-4" />
              <span>Рескор</span>
            </Button>
            <Button size="sm" onClick={() => setCollectDialogOpen(true)} className="min-w-0 justify-center px-2 sm:px-3">
              <Plus className="h-4 w-4" />
              <span>Собрать</span>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to="/agents" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Card className="nr-stat h-full border-cyan-100/80 transition-all group-hover:-translate-y-0.5 group-hover:border-cyan-200 group-hover:shadow-md">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-3xl font-black leading-none tracking-tight tabular-nums text-slate-950">{stats.agents}</p>
                  <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Агента</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/feed" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Card className="nr-stat h-full border-cyan-100/80 transition-all group-hover:-translate-y-0.5 group-hover:border-cyan-200 group-hover:shadow-md">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                  <Newspaper className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-3xl font-black leading-none tracking-tight tabular-nums text-slate-950">{stats.articles}</p>
                  <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Новостей</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/sources" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Card className="nr-stat h-full border-cyan-100/80 transition-all group-hover:-translate-y-0.5 group-hover:border-cyan-200 group-hover:shadow-md">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                  <Rss className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-3xl font-black leading-none tracking-tight tabular-nums text-slate-950">{stats.sources}</p>
                  <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Источников</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/feed" search={{ favorites: '1' }} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Card className="nr-stat h-full border-cyan-100/80 transition-all group-hover:-translate-y-0.5 group-hover:border-cyan-200 group-hover:shadow-md">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                  <Bookmark className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-3xl font-black leading-none tracking-tight tabular-nums text-slate-950">{stats.favorites}</p>
                  <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">В избранном</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
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
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-cyan-100/80 bg-gradient-to-r from-white to-slate-50/70 p-3.5 transition-all hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md hover:shadow-cyan-100/70"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/5"
                          style={{ backgroundColor: agent.color ? `${agent.color}18` : undefined, color: agent.color || undefined }}
                        >
                          <AgentIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-accent">{agent.name}</p>
                          <p className="text-xs font-medium text-muted-foreground">{agent.article_count ?? 0} новостей</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge variant={agent.is_active ? 'success' : 'default'} className="rounded-full px-2.5">
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
              <CardDescription>Нажми на partial/failed, чтобы увидеть ошибку источника</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {operationLogsLoading ? (
                Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14 rounded-2xl" />)
              ) : operationLogsError ? (
                <p className="rounded-2xl border border-danger/30 bg-danger-light p-3 text-sm text-danger">
                  {operationLogsError}
                </p>
              ) : operationLogs.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/40 p-4 text-sm text-muted-foreground">Журнал пока пуст</p>
              ) : (
                operationLogs.map((log) => <OperationLogRow key={log.id} log={log} />)
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden border-cyan-100/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg">Избранное</CardTitle>
                  <CardDescription>Сохранённые материалы</CardDescription>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                  <Bookmark className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {favoritesLoading ? (
                Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-2xl" />)
              ) : favorites.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-rose-100 bg-rose-50/40 py-8 text-center text-sm text-muted-foreground">Нет избранных материалов</p>
              ) : (
                favorites.map((item) => (
                  <Link
                    key={item.id}
                    to="/feed/article/$id"
                    params={{ id: item.id }}
                    className="group block cursor-pointer rounded-2xl border border-cyan-100/80 bg-white/80 p-3.5 transition-all hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md hover:shadow-cyan-100/60"
                  >
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 transition-colors group-hover:text-accent">
                      {item.title}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="nr-chip">{item.source_name}</span>
                      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                        {formatDateTime(item.published_at)}
                      </span>
                    </div>
                  </Link>
                ))
              )}
              <Button
                variant="ghost"
                className="w-full rounded-xl text-sm"
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
