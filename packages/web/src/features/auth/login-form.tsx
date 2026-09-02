import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@shared/stores/auth-store';
import { NEWSRADAR_ICON_SRC } from '@shared/brand/newsradar-icon';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Separator } from '@shared/ui/separator';
import { AlertCircle, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';

export function LoginForm() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!email.trim()) {
      errors.email = 'Введите email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Некорректный email';
    }
    if (!password) {
      errors.password = 'Введите пароль';
    } else if (password.length < 6) {
      errors.password = 'Минимум 6 символов';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;
    try {
      await login(email, password);
      navigate({ to: '/' });
    } catch {
      // Error handled by store
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-8">
      <div className="nr-enter-1 w-full max-w-[23rem] space-y-7">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center nr-glow-hover">
            <img src={NEWSRADAR_ICON_SRC} alt="Newsradar" className="relative h-full w-full object-contain nr-icon-orb" />
          </div>
          <div className="text-center">
            <h1 className="nr-iris-text font-display text-[28px] font-extrabold tracking-[-0.04em]">Newsradar</h1>
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">
              AI news studio
            </p>
          </div>
        </div>

        <Card className="rounded-2xl shadow-[var(--shadow-lg)]">
          <CardHeader className="pb-4">
            <CardTitle>Вход</CardTitle>
            <CardDescription>Введите ваш email и пароль</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-light p-3 text-[13px] font-medium text-danger">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                id="email"
                type="email"
                label="Email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (validationErrors.email) setValidationErrors((p) => ({ ...p, email: '' }));
                }}
                error={validationErrors.email}
                autoComplete="email"
                autoFocus
              />

              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  label="Пароль"
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationErrors.password) setValidationErrors((p) => ({ ...p, password: '' }));
                  }}
                  error={validationErrors.password}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="absolute right-2 top-[31px] rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-muted hover:text-accent"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <Button type="submit" variant="primary" size="lg" className="w-full" loading={isLoading}>
                <LogIn className="h-4 w-4" />
                Войти
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-300">или</span>
              <Separator className="flex-1" />
            </div>

            <div className="grid gap-2">
              <a
                href="/api/v1/auth/google"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-hairline bg-white px-4 text-[13.5px] font-semibold text-ink-700 transition-all hover:border-border hover:shadow-[var(--shadow-sm)]"
              >
                Войти через Google
              </a>
              <a
                href="/api/v1/auth/yandex"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-hairline bg-white px-4 text-[13.5px] font-semibold text-ink-700 transition-all hover:border-border hover:shadow-[var(--shadow-sm)]"
              >
                Войти через Яндекс
              </a>
            </div>
          </CardContent>
        </Card>

        <Link
          to="/register"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-white/70 px-4 text-[13.5px] font-semibold text-ink-700 backdrop-blur-sm transition-all hover:border-border hover:bg-white hover:shadow-[var(--shadow-sm)]"
        >
          <UserPlus className="h-4 w-4" />
          Создать аккаунт
        </Link>
      </div>
    </div>
  );
}
