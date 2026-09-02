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
    <div className="min-w-0 space-y-7 overflow-x-hidden">
      <section className="nr-hero nr-enter-1 rounded-3xl p-6 sm:p-8">
        {/* Radar sweep — the product pings, so the hero does too. */}
        <div className="nr-sonar hidden lg:block" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="nr-hero-film" aria-hidden="true" />
        <span className="nr-hero-scrim" aria-hidden="true" />
        <span className="nr-hero-edge" aria-hidden="true" />
        <div className="relative z-10 flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/75 backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Рабочее пространство готово
            </div>
            <div>
              <h1 className="font-display text-[26px] font-bold leading-[1.08] tracking-[-0.035em] text-white sm:text-[34px]">
                Привет, {user?.name?.split(' ')[0] || 'пользователь'}
              </h1>
              <p className="mt-2.5 max-w-md text-[13.5px] leading-relaxed text-white/60">
                Сводка дня: сбор, агенты и избранное — в одном спокойном экране.
              </p>
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              title="Обновить данные"
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-white/55 transition-colors hover:border-white/35 hover:text-white/90"
            >
              <RefreshCw className="h-3 w-3 transition-transform duration-500 group-hover:rotate-180" />
              {formatRefreshLabel(lastRefreshedAt)}
            </button>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteAllArticles}
              loading={deleteAllLoading}
              className="min-w-0 justify-center border border-white/12 px-2 text-white/70 hover:bg-white/10 hover:text-white sm:px-3"
            >
              <Trash2 className="h-4 w-4" />
              <span>Удалить</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRescore}
              loading={rescoreLoading}
              className="min-w-0 justify-center border border-white/12 px-2 text-white/70 hover:bg-white/10 hover:text-white sm:px-3"
            >
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

      <div className="nr-enter-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to="/agents" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2">
          <Card className="nr-stat h-full">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-light text-accent ring-1 ring-accent/12">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-[28px] font-bold leading-none tracking-[-0.04em] tabular-nums text-ink-900">{stats.agents}</p>
                  <p className="nr-eyebrow mt-2">Агента</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/feed" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2">
          <Card className="nr-stat h-full">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-light text-success ring-1 ring-success/12">
                  <Newspaper className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-[28px] font-bold leading-none tracking-[-0.04em] tabular-nums text-ink-900">{stats.articles}</p>
                  <p className="nr-eyebrow mt-2">Новостей</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/sources" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2">
          <Card className="nr-stat h-full">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-light text-signal ring-1 ring-signal/20">
                  <Rss className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-[28px] font-bold leading-none tracking-[-0.04em] tabular-nums text-ink-900">{stats.sources}</p>
                  <p className="nr-eyebrow mt-2">Источников</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/feed" search={{ favorites: '1' }} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2">
          <Card className="nr-stat h-full">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-light text-danger ring-1 ring-danger/12">
                  <Bookmark className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-[28px] font-bold leading-none tracking-[-0.04em] tabular-nums text-ink-900">{stats.favorites}</p>
                  <p className="nr-eyebrow mt-2">В избранном</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="nr-enter-3 grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle>Агенты сбора</CardTitle>
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
                  <Bot className="mb-3 h-8 w-8 text-ink-300" />
                  <p className="mb-4 text-[13px] text-ink-400">Нет агентов</p>
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
                      className="group flex items-center justify-between gap-3 rounded-xl border border-hairline bg-white p-3.5 transition-all duration-200 hover:-translate-y-px hover:border-border hover:shadow-[var(--shadow-sm)]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5"
                          style={{ backgroundColor: agent.color ? `${agent.color}18` : undefined, color: agent.color || undefined }}
                        >
                          <AgentIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold text-ink-900 transition-colors group-hover:text-accent">{agent.name}</p>
                          <p className="mt-0.5 text-[11px] font-medium tabular-nums text-ink-400">{agent.article_count ?? 0} новостей</p>
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
              <CardTitle>Последние операции</CardTitle>
              <CardDescription>Нажми на partial/failed, чтобы увидеть ошибку источника</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {operationLogsLoading ? (
                Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14 rounded-2xl" />)
              ) : operationLogsError ? (
                <p className="rounded-xl border border-danger/20 bg-danger-light p-3 text-[13px] text-danger">
                  {operationLogsError}
                </p>
              ) : operationLogs.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/50 p-4 text-[13px] text-ink-400">Журнал пока пуст</p>
              ) : (
                operationLogs.map((log) => <OperationLogRow key={log.id} log={log} />)
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle>Избранное</CardTitle>
                  <CardDescription>Сохранённые материалы</CardDescription>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal-light text-signal ring-1 ring-signal/20">
                  <Bookmark className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {favoritesLoading ? (
                Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-2xl" />)
              ) : favorites.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/50 py-8 text-center text-[13px] text-ink-400">Нет избранных материалов</p>
              ) : (
                favorites.map((item) => (
                  <Link
                    key={item.id}
                    to="/feed/article/$id"
                    params={{ id: item.id }}
                    className="group block cursor-pointer rounded-xl border border-hairline bg-white p-3.5 transition-all duration-200 hover:-translate-y-px hover:border-border hover:shadow-[var(--shadow-sm)]"
                  >
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink-900 transition-colors group-hover:text-accent">
                      {item.title}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="nr-chip">{item.source_name}</span>
                      <span className="shrink-0 text-[10px] font-medium tabular-nums text-ink-400">
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
