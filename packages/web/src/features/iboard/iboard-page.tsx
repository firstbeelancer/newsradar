import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Skeleton } from '@shared/ui/skeleton';
import { useIBoardStore } from '@shared/stores/iboard-store';
import { useSubscriptionStore } from '@shared/stores/subscription-store';
import { Button } from '@shared/ui/button';
import { Link } from '@tanstack/react-router';
import {
  BarChart3,
  TrendingUp,
  Newspaper,
  Radio,
  Calendar,
  Crown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';
import { cn } from '@shared/lib/utils';

/* ─── Pro Gate ─── */
function ProGate({ children }: { children: React.ReactNode }) {
  const { subscription } = useSubscriptionStore();
  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active';

  if (isPro) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warning-light text-warning mb-4">
        <Crown className="h-8 w-8" />
      </div>
      <h2 className="text-lg font-semibold mb-1">Требуется подписка Pro</h2>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        Аналитический дашборд iBoard доступен только для подписчиков Pro. Активируйте Pro для доступа к метрикам.
      </p>
      <Button asChild size="sm">
        <Link to="/subscription">
          <Crown className="h-4 w-4 mr-1.5" />
          Активировать Pro
        </Link>
      </Button>
    </div>
  );
}

/* ─── KPI Card ─── */
function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  isLoading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold tabular-nums">{value}</p>
            )}
            {isLoading ? (
              <Skeleton className="h-3 w-24" />
            ) : subtitle ? (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            trend === 'up' ? 'bg-success-light text-success' :
            trend === 'down' ? 'bg-danger-light text-danger' :
            'bg-accent-light text-accent'
          )}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Timeline Chart ─── */
function TimelineChart({ data, isLoading }: { data: Array<{ date: string; count: number }>; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-end gap-1 h-40 px-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${30 + Math.random() * 70}%` }} />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Нет данных
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="px-4 pb-2">
      <div className="flex items-end gap-[3px] h-40">
        {data.map((point, idx) => {
          const height = Math.max(4, (point.count / maxCount) * 100);
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex justify-center group relative">
                <div
                  className="w-full max-w-[32px] rounded-t-md bg-accent/80 hover:bg-accent transition-all cursor-pointer"
                  style={{ height: `${height * 1.4}px` }}
                  title={`${point.date}: ${point.count} статей`}
                />
                {/* Tooltip */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-[10px] font-medium px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-10">
                  {point.count}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {new Date(point.date).toLocaleDateString('ru-RU', { weekday: 'short' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default'; icon: React.ElementType; label: string }> = {
    healthy: { variant: 'success', icon: CheckCircle2, label: 'OK' },
    warning: { variant: 'warning', icon: AlertTriangle, label: 'Предупреждение' },
    error: { variant: 'danger', icon: XCircle, label: 'Ошибка' },
    inactive: { variant: 'default', icon: Minus, label: 'Неактивен' },
  };

  const { variant, icon: Icon, label } = config[status] || config.inactive;

  return (
    <Badge variant={variant} className="gap-1 text-[10px]">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

/* ─── Main Page ─── */
export function IBoardPage() {
  const {
    stats,
    timeline,
    leaderboard,
    sourcesHealth,
    isLoading,
    fetchAll,
  } = useIBoardStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            iBoard
          </h1>
          <p className="text-sm text-muted-foreground">Аналитический дашборд</p>
        </div>
      </div>

      <ProGate>
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            title="Всего статей"
            value={stats?.total_articles ?? 0}
            subtitle="В базе данных"
            icon={Newspaper}
            trend="up"
            isLoading={isLoading}
          />
          <KPICard
            title="Средний score"
            value={stats?.avg_score?.toFixed(1) ?? '0.0'}
            subtitle="По всем статьям"
            icon={TrendingUp}
            trend="neutral"
            isLoading={isLoading}
          />
          <KPICard
            title="Активные источники"
            value={stats?.active_sources ?? 0}
            subtitle="Работают сейчас"
            icon={Radio}
            trend="up"
            isLoading={isLoading}
          />
          <KPICard
            title="Новости сегодня"
            value={stats?.news_today ?? 0}
            subtitle="За последние 24ч"
            icon={Calendar}
            trend="up"
            isLoading={isLoading}
          />
        </div>

        {/* Timeline + Leaderboard */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Активность за 7 дней
              </CardTitle>
            </CardHeader>
            <TimelineChart data={timeline} isLoading={isLoading} />
          </Card>

          {/* Leaderboard */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Топ-10 статей по score
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Нет данных</p>
              ) : (
                <div className="divide-y divide-border">
                  {leaderboard.slice(0, 10).map((article, idx) => (
                    <div key={article.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                      <span className={cn(
                        'flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold shrink-0',
                        idx === 0 ? 'bg-warning-light text-warning' :
                        idx === 1 ? 'bg-muted text-muted-foreground' :
                        idx === 2 ? 'bg-orange-100 text-orange-600' :
                        'text-muted-foreground'
                      )}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate font-medium">{article.title}</p>
                        <p className="text-[11px] text-muted-foreground">{article.source_name}</p>
                      </div>
                      <Badge variant="primary" className="text-[10px] tabular-nums shrink-0">
                        {article.score.toFixed(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sources Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Radio className="h-4 w-4 text-muted-foreground" />
              Здоровье источников
            </CardTitle>
            <CardDescription>Статус и доступность источников сбора</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Источник</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Статус</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Успех</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Статьи (7д)</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Последний сбор</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="px-4 py-2"><Skeleton className="h-8" /></td>
                      </tr>
                    ))
                  ) : sourcesHealth.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Нет данных</td>
                    </tr>
                  ) : (
                    sourcesHealth.map((source) => (
                      <tr key={source.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <div>
                            <p className="font-medium text-sm">{source.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{source.url}</p>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={source.status} />
                        </td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn('h-full rounded-full', source.fetch_success_rate >= 0.8 ? 'bg-success' : source.fetch_success_rate >= 0.5 ? 'bg-warning' : 'bg-danger')}
                                style={{ width: `${Math.round(source.fetch_success_rate * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {Math.round(source.fetch_success_rate * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-sm tabular-nums hidden md:table-cell">
                          {source.articles_count_7d}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                          {source.last_fetch_at
                            ? new Date(source.last_fetch_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </ProGate>
    </div>
  );
}
