import { useState, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@shared/stores/auth-store';
import { useAgentsStore } from '@shared/stores/agents-store';
import { articlesApi } from '@shared/api/client';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Skeleton } from '@shared/ui/skeleton';
import { Avatar, AvatarFallback } from '@shared/ui/avatar';
import { Separator } from '@shared/ui/separator';
import { AgentCollectDialog } from '@/features/agents/agent-collect-dialog';
import { useToast } from '@shared/ui/toast';
import {
  Plus,
  Bot,
  Bookmark,
  Clock,
  ArrowRight,
  Newspaper,
  TrendingUp,
  Zap,
  ChevronRight,
  CircleDot,
} from 'lucide-react';
import type { Article } from '@shared/api/client';

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
  const [totalArticles, setTotalArticles] = useState(0);
  const [collectDialogOpen, setCollectDialogOpen] = useState(false);

  useEffect(() => {
    fetchAgents();
    loadFavorites();
  }, [fetchAgents]);

  const loadFavorites = async () => {
    setFavoritesLoading(true);
    try {
      const response = await articlesApi.list({ favorites_only: true }, undefined, 5);
      setFavorites(response.data);
      setFavoritesCount(response.data.length);

      // Load total articles count (approximate from first page)
      const allArticles = await articlesApi.list({}, undefined, 1);
      // We can't get exact total from cursor pagination, so estimate
      setTotalArticles(allArticles.data.length > 0 ? Math.max(response.data.length, 1) : 0);
    } catch {
      setFavorites([]);
    } finally {
      setFavoritesLoading(false);
    }
  };

  const handleCollect = async (agentId: string) => {
    try {
      await collectAgent(agentId);
      addToast({ title: 'Сбор запущен', description: 'Агент собирает новости', variant: 'success' });
    } catch {
      // Error handled by store
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
        <Button onClick={() => setCollectDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Собрать новости</span>
        </Button>
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

          {/* Recent activity - placeholder */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Последние операции</CardTitle>
              <CardDescription>История последних действий</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between rounded-lg p-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">История операций</p>
                    <p className="text-xs text-muted-foreground">Будет доступна в следующей версии</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick action */}
          <Card className="bg-accent text-white">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Новый сбор</p>
                  <p className="text-xs text-white/70">Запустить сбор новостей</p>
                </div>
              </div>
              <Button
                variant="secondary"
                className="w-full bg-white text-accent hover:bg-white/90"
                onClick={() => setCollectDialogOpen(true)}
              >
                <Zap className="h-4 w-4" />
                Запустить
              </Button>
            </CardContent>
          </Card>

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

          {/* User card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-accent-light text-accent">
                    {user?.name ? getInitials(user.name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || 'Пользователь'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
                </div>
              </div>
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
