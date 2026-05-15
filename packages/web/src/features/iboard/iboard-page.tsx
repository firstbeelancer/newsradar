import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Link } from '@tanstack/react-router';
import { useSubscriptionStore } from '@shared/stores/subscription-store';
import { apiGet } from '@shared/api/client';
import { BarChart3, Crown, Newspaper, Radio, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';

interface IBoardAPIStats {
  totalArticles: number;
  avgScore: number;
  topSources: Array<{ sourceId: string; sourceName: string; articleCount: number }>;
  activity7d: Array<{ date: string; count: number }>;
}

function MetricCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light text-accent">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IBoardPage() {
  const { subscription, fetchSubscription, isLoading: subLoading } = useSubscriptionStore();
  const [stats, setStats] = useState<IBoardAPIStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [subReady, setSubReady] = useState(false);

  useEffect(() => {
    fetchSubscription()
      .catch(() => {
        // Subscription fetch failed, handled gracefully
      })
      .finally(() => {
        setSubReady(true);
      });
  }, [fetchSubscription]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiGet<IBoardAPIStats>('/iboard/stats');
      setStats(data);
      setStatsError(false);
    } catch {
      // Gracefully handle: show basic UI even if stats API is unavailable
      setStats(null);
      setStatsError(false); // Don't show error, just show empty state
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active';
  const plan = subscription?.plan || 'free';

  // Compute derived values from API response
  const totalArticles = stats?.totalArticles ?? 0;
  const avgScore = stats?.avgScore ?? 0;
  const activeSources = stats?.topSources?.length ?? 0;
  const todayCount = stats?.activity7d?.[stats.activity7d.length - 1]?.count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <BarChart3 className="h-5 w-5" />
          Аналитика
        </h1>
        <p className="text-sm text-muted-foreground">Статистика и аналитика новостей</p>
      </div>

      {!isPro && plan === 'free' && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-warning-light text-warning">
              <Crown className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold">Полная аналитика — в подписке Pro</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Базовая статистика доступна бесплатно. Для полной аналитики с графиками, лидербордом и мониторингом источников подключите Pro.
            </p>
            <Button asChild className="mt-4" size="sm">
              <Link to="/subscription">Открыть текущий план</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {statsError ? (
          <Card>
            <CardContent className="flex flex-col items-center py-8 text-center">
              <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Не удалось загрузить статистику</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchStats}>
                Попробовать снова
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard title="Всего статей" value={stats ? totalArticles : '—'} icon={Newspaper} />
            <MetricCard title="Средний score" value={stats ? avgScore.toFixed(1) : '—'} icon={TrendingUp} />
            <MetricCard title="Источники" value={stats ? activeSources : '—'} icon={Radio} />
            <MetricCard title="Сегодня" value={stats ? todayCount : '—'} icon={Calendar} />
          </div>
        )}

        {isPro && !statsError && stats && stats.topSources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Топ источники</CardTitle>
              <CardDescription>Источники с наибольшим количеством статей</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.topSources.map((source) => (
                  <div key={source.sourceId} className="flex items-center justify-between text-sm">
                    <span className="truncate">{source.sourceName}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">{source.articleCount} статей</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isPro && !statsError && stats && stats.activity7d.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Активность за 7 дней</CardTitle>
              <CardDescription>Количество новых статей по дням</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {stats.activity7d.map((day) => (
                  <div key={day.date} className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground w-20 shrink-0 text-xs">{new Date(day.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(2, (day.count / Math.max(...stats.activity7d.map(d => d.count), 1)) * 100))}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{day.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {subLoading && !subReady && <p className="text-sm text-muted-foreground">Загрузка…</p>}
    </div>
  );
}
