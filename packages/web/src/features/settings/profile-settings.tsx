import { useState } from 'react';
import { useAuthStore } from '@shared/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Avatar, AvatarFallback } from '@shared/ui/avatar';
import { Badge } from '@shared/ui/badge';
import { Separator } from '@shared/ui/separator';
import { useToast } from '@shared/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/ui/dialog';
import { User, Mail, Shield, Pencil, Key, Save, Camera } from 'lucide-react';
import { apiPatch } from '@shared/api/client';

export function ProfileSettings() {
  const { user, setUser } = useAuthStore();
  const { addToast } = useToast();

  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const openProfileEdit = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setProfileOpen(true);
  };

  const handleProfileSave = async () => {
    if (!name.trim()) {
      addToast({ title: 'Ошибка', description: 'Имя не может быть пустым', variant: 'danger' });
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await apiPatch<any, { name?: string; email?: string }>('/auth/profile', {
        name: name.trim(),
        email: email.trim(),
      });
      setUser({
        ...user!,
        name: updated.name || name,
        email: updated.email || email,
      });
      addToast({ title: 'Сохранено', description: 'Профиль обновлен', variant: 'success' });
      setProfileOpen(false);
    } catch (err) {
      addToast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось обновить профиль',
        variant: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast({ title: 'Ошибка', description: 'Заполните все поля', variant: 'danger' });
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast({ title: 'Ошибка', description: 'Пароли не совпадают', variant: 'danger' });
      return;
    }
    if (newPassword.length < 6) {
      addToast({ title: 'Ошибка', description: 'Пароль должен быть не менее 6 символов', variant: 'danger' });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiPatch<any, { currentPassword: string; newPassword: string }>('/auth/password', {
        currentPassword,
        newPassword,
      });
      addToast({ title: 'Сохранено', description: 'Пароль обновлен', variant: 'success' });
      setPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      addToast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось обновить пароль',
        variant: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Профиль</CardTitle>
          <CardDescription>Информация о вашем аккаунте</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar & Name */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-accent-light text-accent text-lg">
                  {user?.name ? getInitials(user.name) : '?'}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold">{user?.name || 'Пользователь'}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  {user?.role === 'admin' ? 'Администратор' : 'Пользователь'}
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={openProfileEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Редактировать
            </Button>
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Имя</p>
                <p className="text-sm font-medium">{user?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{user?.email}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <CardTitle>Безопасность</CardTitle>
          <CardDescription>Управление паролем и безопасностью аккаунта</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Пароль</p>
                <p className="text-xs text-muted-foreground">Измените пароль для повышения безопасности</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
              <Key className="h-4 w-4 mr-2" />
              Сменить пароль
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать профиль</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              label="Имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше имя"
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProfileOpen(false)}>Отмена</Button>
            <Button onClick={handleProfileSave} loading={isSubmitting}>
              <Save className="h-4 w-4 mr-2" />
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Сменить пароль</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              label="Текущий пароль"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Введите текущий пароль"
            />
            <Input
              label="Новый пароль"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Минимум 6 символов"
            />
            <Input
              label="Подтвердите пароль"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите новый пароль"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasswordOpen(false)}>Отмена</Button>
            <Button onClick={handlePasswordSave} loading={isSubmitting}>
              <Save className="h-4 w-4 mr-2" />
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
