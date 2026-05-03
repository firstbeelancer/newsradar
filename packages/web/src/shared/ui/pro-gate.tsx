import { useEffect, useState } from 'react';
import { Card, CardContent } from './card';
import { Button } from './button';
import { Link } from '@tanstack/react-router';
import { Crown, Loader2 } from 'lucide-react';
import { subscriptionApi, type Subscription } from '@shared/api/client';

interface ProFeatureGateProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function ProFeatureGate({
  children,
  title = 'Требуется подписка Pro',
  description = 'Эта функция доступна только для подписчиков Pro. Активируйте Pro для доступа.',
}: ProFeatureGateProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const sub = await subscriptionApi.get();
        if (!cancelled) setSubscription(sub);
      } catch {
        if (!cancelled) setSubscription({ plan: 'free', status: 'active', current_period_start: '', current_period_end: '', cancel_at_period_end: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active';

  if (isPro) {
    return <>{children}</>;
  }

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-light text-warning mb-3">
          <Crown className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
        <Button asChild size="sm">
          <Link to="/subscription">
            <Crown className="h-4 w-4 mr-1.5" />
            Активировать Pro
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
