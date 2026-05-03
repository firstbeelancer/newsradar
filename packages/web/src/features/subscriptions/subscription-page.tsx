import { useEffect, useState } from 'react';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Skeleton } from '@shared/ui/skeleton';
import { useSubscriptionStore } from '@shared/stores/subscription-store';
import { useToast } from '@shared/ui/toast';
import { Check, X, Crown, CreditCard, RotateCcw, AlertTriangle } from 'lucide-react';
import { cn } from '@shared/lib/utils';

const PLAN_FEATURES = [
  { feature: 'Агенты сбора', free: '5', pro: 'Неограничено' },
  { feature: 'Источники', free: '20', pro: 'Неограничено' },
  { feature: 'Избранное', free: '100 статей', pro: 'Неограничено' },
  { feature: 'Подборки', free: '30', pro: 'Неограничено' },
  { feature: 'Генерация постов', free: '50/мес', pro: 'Неограничено' },
  { feature: 'iBoard аналитика', free: false, pro: true },
  { feature: 'Deep Search', free: false, pro: true },
  { feature: 'Приоритетная поддержка', free: false, pro: true },
];

const LIMIT_KEYS: Array<{ key: keyof typeof import('@shared/api/client').SubscriptionLimits extends never ? never : string; label: string }> = [
  { key: 'favorites_used', label: 'Избранное' },
  { key: 'collections_used', label: 'Подборки' },
  { key: 'agents_used', label: 'Агенты' },
  { key: 'sources_used', label: 'Источники' },
  { key: 'generation_used', label: 'Генерация' },
];

export function SubscriptionPage() {
  const { addToast } = useToast();
  const {
    subscription,
    limits,
    payments,
    isLoading,
    isCreating,
    isCanceling,
    fetchSubscription,
    fetchLimits,
    fetchPayments,
    createPayment,
    cancelSubscription,
  } = useSubscriptionStore();

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    fetchSubscription();
    fetchLimits();
    fetchPayments();
  }, [fetchSubscription, fetchLimits, fetchPayments]);

  const handleActivatePro = async () => {
    try {
      const url = await createPayment();
      window.location.href = url;
    } catch {
      addToast({ title: 'Ошибка', description: 'Не удалось создать платёж', variant: 'danger' });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSubscription();
      setShowCancelConfirm(false);
      addToast({ title: 'Подписка отменена', description: 'Доступ к Pro сохранится до конца периода', variant: 'success' });
    } catch {
      addToast({ title: 'Ошибка', description: 'Не удалось отменить подписку', variant: 'danger' });
    }
  };

  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active';

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: currency || 'RUB' }).format(amount / 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Подписка</h1>
        <p className="text-sm text-muted-foreground">Управление тарифным планом</p>
      </div>

      {/* Current Plan Card */}
      <Card className={cn('border-2', isPro ? 'border-warning/30' : 'border-border')}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', isPro ? 'bg-warning-light text-warning' : 'bg-muted text-muted-foreground')}>
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Текущий план</CardTitle>
                <CardDescription>
                  {isPro ? 'Действует до ' + formatDate(subscription?.current_period_end || '') : 'Базовый функционал'}
                </CardDescription>
              </div>
            </div>
            <Badge variant={isPro ? 'warning' : 'default'} className="text-xs">
              {isPro ? 'PRO' : 'FREE'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPro && subscription?.cancel_at_period_end && (
            <div className="flex items-center gap-2 rounded-lg bg-warning-light px-3 py-2 text-sm text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Подписка не будет продлена. Доступ сохранится до {formatDate(subscription.current_period_end)}.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!isPro ? (
              <Button onClick={handleActivatePro} loading={isCreating} size="sm">
                <Crown className="h-4 w-4 mr-1.5" />
                Активировать Pro
              </Button>
            ) : !subscription?.cancel_at_period_end ? (
              <Button variant="outline" size="sm" onClick={() => setShowCancelConfirm(true)} loading={isCanceling}>
                <CreditCard className="h-4 w-4 mr-1.5" />
                Отменить подписку
              </Button>
            ) : (
              <Button onClick={handleActivatePro} loading={isCreating} size="sm">
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Возобновить подписку
              </Button>
            )}
          </div>

          {showCancelConfirm && (
            <div className="rounded-lg border border-danger/30 bg-danger-light p-3 space-y-2">
              <p className="text-sm text-danger font-medium">Подтвердите отмену</p>
              <p className="text-xs text-danger/80">Доступ к Pro сохранится до конца оплаченного периода.</p>
              <div className="flex gap-2">
                <Button variant="danger" size="sm" onClick={handleCancel} loading={isCanceling}>
                  Отменить подписку
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowCancelConfirm(false)}>
                  Назад
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Использование лимитов</CardTitle>
          <CardDescription>Текущее потребление ресурсов</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !limits ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {LIMIT_KEYS.map(({ key, label }) => {
                const used = (limits[key as keyof typeof limits] as number) || 0;
                const limitKey = key.replace('_used', '_limit');
                const limit = (limits[limitKey as keyof typeof limits] as number) || 1;
                const percent = Math.min(100, Math.round((used / limit) * 100));
                const isNearLimit = percent >= 80;

                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{label}</span>
                      <span className={cn('text-muted-foreground', isNearLimit && 'text-warning font-medium')}>
                        {used} / {limit}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', isNearLimit ? 'bg-warning' : 'bg-accent')}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Сравнение планов</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Возможность</th>
                  <th className="px-5 py-3 text-center font-medium text-muted-foreground w-24">Free</th>
                  <th className="px-5 py-3 text-center font-medium text-accent w-24">Pro</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_FEATURES.map((row, idx) => (
                  <tr key={row.feature} className={cn('border-b border-border last:border-0', idx % 2 === 1 && 'bg-muted/30')}>
                    <td className="px-5 py-3 font-medium">{row.feature}</td>
                    <td className="px-5 py-3 text-center">
                      {typeof row.free === 'boolean' ? (
                        row.free ? <Check className="h-4 w-4 text-success mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">{row.free}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {typeof row.pro === 'boolean' ? (
                        row.pro ? <Check className="h-4 w-4 text-success mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      ) : (
                        <span className="font-medium text-accent">{row.pro}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">История платежей</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Нет платежей</p>
          ) : (
            <div className="space-y-2">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      payment.status === 'succeeded' ? 'bg-success-light text-success' : 'bg-muted text-muted-foreground'
                    )}>
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{payment.description || 'Подписка Pro'}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(payment.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatAmount(payment.amount, payment.currency)}</p>
                    <Badge
                      variant={payment.status === 'succeeded' ? 'success' : payment.status === 'pending' ? 'warning' : 'default'}
                      className="text-[10px]"
                    >
                      {payment.status === 'succeeded' ? 'Успешно' : payment.status === 'pending' ? 'В обработке' : payment.status === 'failed' ? 'Ошибка' : 'Отменён'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
