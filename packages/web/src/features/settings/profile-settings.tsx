import { useState } from 'react';
import { useAuthStore } from '@shared/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Avatar, AvatarFallback } from '@shared/ui/avatar';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Separator } from '@shared/ui/separator';
import { useToast } from '@shared/ui/toast';
import { User, Mail, Shield, Save, Lock } from 'lucide-react';
import { apiPut } from '@shared/api/client';

export function ProfileSettings() {
  const { user, setUser } = useAuthStore();
  const { addToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const getInitials = (n: string) => {
    return n
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      addToast({ title: 'Ошибка', description: 'Имя не может быть пустым', variant: 'danger' });
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await apiPut<{ name: string; email: string }, { name: string; email: string }>(
        '/auth/profile',
        { name: name.trim(), email: email.trim() },
        { workspace: false }
      );
      if (setUser && user) {
        setUser({ ...user, name: updated.name || name.trim(), email: updated.email || email.trim() });
      }
      addToast({ title: 'Профиль обновлён', variant: 'success' });
    } catch (err) {
      addToast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось обновить профиль',
        variant: 'danger',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      addToast({ title: 'Ошибка', description: 'Заполните все поля пароля', variant: 'danger' });
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast({ title: 'Ошибка', description: 'Пароли не совпадают', variant: 'danger' });
      return;
    }
    if (newPassword.length < 6) {
      addToast({ title: 'Ошибка', description: 'Пароль минимум 6 символов', variant: 'danger' });
      return;
    }
    setSavingPassword(true);
    try {
      await apiPut<void, { currentPassword: string; newPassword: string }>(
        '/auth/password',
        { currentPassword, newPassword },
        { workspace: false }
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      addToast({ title: 'Пароль изменён', variant: 'success' });
    } catch (err) {
      addToast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось изменить пароль',
        variant: 'danger',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Профиль</CardTitle>
          <CardDescription>Информация о вашем аккаунте</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar & Name */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-accent-light text-accent text-lg">
                {user?.name ? getInitials(user.name) : '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{user?.name || 'Пользователь'}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  {user?.role === 'admin' ? 'Администратор' : 'Пользователь'}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Editable fields */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Имя
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm">
              <Save className="h-4 w-4 mr-1" />
              {savingProfile ? 'Сохранение...' : 'Сохранить профиль'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Изменить пароль
          </CardTitle>
          <CardDescription>Обновите пароль для входа в систему</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Текущий пароль</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Новый пароль</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Подтвердите пароль</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={savingPassword} size="sm" variant="outline">
            <Lock className="h-4 w-4 mr-1" />
            {savingPassword ? 'Изменение...' : 'Изменить пароль'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
