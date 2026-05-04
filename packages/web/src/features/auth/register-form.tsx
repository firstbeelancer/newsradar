import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@shared/stores/auth-store';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Separator } from '@shared/ui/separator';
import { AlertCircle, Eye, EyeOff, LogIn, Newspaper, UserPlus } from 'lucide-react';

export function RegisterForm() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = 'Введите имя';
    } else if (name.trim().length < 2) {
      errors.name = 'Минимум 2 символа';
    }
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
      await register(name, email, password);
      navigate({ to: '/' });
    } catch {
      // Error handled by store
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-200 ring-1 ring-blue-400/20">
            <Newspaper className="h-8 w-8" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Newsradar</h1>
            <p className="text-sm text-slate-500">Создание аккаунта</p>
          </div>
        </div>

        <Card className="border-slate-200/80 shadow-xl shadow-slate-200/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-slate-950">Регистрация</CardTitle>
            <CardDescription>Заполните форму для создания аккаунта</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <Input
                id="name"
                type="text"
                label="Имя"
                placeholder="Иван Иванов"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (validationErrors.name) setValidationErrors((p) => ({ ...p, name: '' }));
                }}
                error={validationErrors.name}
                autoComplete="name"
                autoFocus
              />
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
                  autoComplete="new-password"
                  helper="Минимум 6 символов"
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="absolute right-2 top-[31px] rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="submit" variant="primary" className="w-full bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200" loading={isLoading}>
                <UserPlus className="h-4 w-4" />
                Создать аккаунт
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-slate-500">или</span>
              <Separator className="flex-1" />
            </div>

            <div className="grid gap-2">
              <a
                href="/api/v1/auth/google"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
              >
                Зарегистрироваться через Google
              </a>
              <a
                href="/api/v1/auth/yandex"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
              >
                Зарегистрироваться через Яндекс
              </a>
            </div>
          </CardContent>
        </Card>

        <Link
          to="/login"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
        >
          <LogIn className="h-4 w-4" />
          Уже есть аккаунт? Войти
        </Link>
      </div>
    </div>
  );
}
