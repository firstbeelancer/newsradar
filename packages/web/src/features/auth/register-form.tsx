import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@shared/stores/auth-store';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Separator } from '@shared/ui/separator';
import { Newspaper, UserPlus, LogIn } from 'lucide-react';

export function RegisterForm() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="flex min-h-[100dvh] items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-lg">
            <Newspaper className="h-7 w-7" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Newsradar</h1>
            <p className="text-sm text-muted-foreground">Создание аккаунта</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Регистрация</CardTitle>
            <CardDescription>Заполните форму для создания аккаунта</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-danger-light p-3 text-sm text-danger">
                  {error}
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
              <Input
                id="password"
                type="password"
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
              />
              <Button type="submit" className="w-full" loading={isLoading}>
                <UserPlus className="h-4 w-4" />
                Создать аккаунт
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">или</span>
          <Separator className="flex-1" />
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate({ to: '/login' })}
        >
          <LogIn className="h-4 w-4" />
          Уже есть аккаунт? Войти
        </Button>
      </div>
    </div>
  );
}
