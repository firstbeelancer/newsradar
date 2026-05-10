import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Link } from '@tanstack/react-router';
import { useSubscriptionStore } from '@shared/stores/subscription-store';
import { BarChart3, Crown, Newspaper, Radio, TrendingUp, Calendar } from 'lucide-react';

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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
  const { subscription, fetchSubscription, isLoading } = useSubscriptionStore();

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <BarChart3 className="h-5 w-5" />
          iBoard
        </h1>
        <p className="text-sm text-muted-foreground">Аналитический дашборд</p>
      </div>

      {!isPro ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-warning-light text-warning">
              <Crown className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold">Требуется подписка Pro</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Аналитический дашборд доступен только для Pro. Сейчас экран стабилизирован и не должен падать.
            </p>
            <Link to="/subscription" className="mt-4 inline-flex h-8 items-center justify-center rounded-md bg-accent px-3 text-xs font-medium text-white shadow-sm hover:bg-accent-hover transition-colors">
              Открыть текущий план
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard title="Всего статей" value={asNumber(0)} icon={Newspaper} />
            <MetricCard title="Средний score" value="0.0" icon={TrendingUp} />
            <MetricCard title="Источники" value={asNumber(0)} icon={Radio} />
            <MetricCard title="Сегодня" value={asNumber(0)} icon={Calendar} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Аналитика</CardTitle>
              <CardDescription>Данные появятся после подключения стабильного API iBoard.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Проверяем подписку…</p>}
    </div>
  );
}
