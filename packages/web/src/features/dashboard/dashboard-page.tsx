import { useAuthStore } from '@shared/stores/auth-store';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Skeleton } from '@shared/ui/skeleton';
import { Avatar, AvatarFallback } from '@shared/ui/avatar';
import { Separator } from '@shared/ui/separator';
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
} from 'lucide-react';

// Placeholder data
const agents = [
  { id: '1', name: 'Технологии', status: 'active' as const, sources: 12, lastRun: '2 мин назад' },
  { id: '2', name: 'Финансы', status: 'active' as const, sources: 8, lastRun: '15 мин назад' },
  { id: '3', name: 'Наука', status: 'paused' as const, sources: 5, lastRun: '1 ч назад' },
];

const recentActivities = [
  { id: '1', action: 'Сбор новостей', agent: 'Технологии', time: '2 мин назад', count: 24 },
  { id: '2', action: 'Генерация отчёта', agent: 'Финансы', time: '30 мин назад', count: 1 },
  { id: '3', action: 'Добавлено в избранное', agent: null, time: '1 ч назад', count: 3 },
  { id: '4', action: 'Сбор новостей', agent: 'Наука', time: '2 ч назад', count: 18 },
];

const bookmarks = [
  { id: '1', title: 'Новые возможности ИИ в 2025 году', source: 'TechCrunch', date: 'Сегодня' },
  { id: '2', title: 'Рынок акций: прогноз на квартал', source: 'Bloomberg', date: 'Вчера' },
];

export function DashboardPage() {
  const { user } = useAuthStore();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
        <Button>
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
                <p className="text-2xl font-bold">3</p>
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
                <p className="text-2xl font-bold">142</p>
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
                <p className="text-2xl font-bold">12</p>
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
                <p className="text-2xl font-bold">28</p>
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
                <Button variant="ghost" size="sm">
                  Все
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light text-accent">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.sources} источников</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {agent.lastRun}
                    </div>
                    <Badge
                      variant={agent.status === 'active' ? 'success' : 'default'}
                    >
                      {agent.status === 'active' ? 'Активен' : 'Пауза'}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Последние операции</CardTitle>
              <CardDescription>История последних действий</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.agent || 'Общее'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                    {activity.count > 1 && (
                      <p className="text-xs font-medium">+{activity.count}</p>
                    )}
                  </div>
                </div>
              ))}
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
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Новый сбор</p>
                  <p className="text-xs text-white/70">Запустить сбор новостей</p>
                </div>
              </div>
              <Button
                variant="secondary"
                className="w-full bg-white text-accent hover:bg-white/90"
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
              {bookmarks.map((item) => (
                <div
                  key={item.id}
                  className="group cursor-pointer rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <p className="text-sm font-medium leading-snug group-hover:text-accent transition-colors">
                    {item.title}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">
                      {item.source}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{item.date}</span>
                  </div>
                </div>
              ))}
              <Button variant="ghost" className="w-full text-sm" size="sm">
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
    </div>
  );
}
