import { useState } from 'react';
import { useAuthStore } from '@shared/stores/auth-store';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Switch } from '@shared/ui/switch';
import { Separator } from '@shared/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { Avatar, AvatarFallback } from '@shared/ui/avatar';
import { Badge } from '@shared/ui/badge';
import {
  User,
  Bell,
  Shield,
  Palette,
  Save,
} from 'lucide-react';

export function SettingsPage() {
  const { user, logout } = useAuthStore();
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    digest: true,
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="nr-page-title">Настройки</h1>
        <p className="text-muted-foreground mt-1">Управление аккаунтом и приложением</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-1.5" />
            Профиль
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-1.5" />
            Уведомления
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-1.5" />
            Внешний вид
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-1.5" />
            Безопасность
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Профиль</CardTitle>
              <CardDescription>Информация о вашем аккаунте</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-accent-light text-accent text-lg">
                    {user?.name ? getInitials(user.name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{user?.name || 'Пользователь'}</p>
                  <p className="text-sm text-muted-foreground">{user?.email || ''}</p>
                  <Badge variant="outline" className="mt-1.5">
                    {user?.role === 'admin' ? 'Администратор' : 'Пользователь'}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Input
                  id="profile-name"
                  label="Имя"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                />
                <Input
                  id="profile-email"
                  label="Email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
                />
                <Button>
                  <Save className="h-4 w-4" />
                  Сохранить
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Уведомления</CardTitle>
              <CardDescription>Настройка способов уведомлений</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  key: 'email' as const,
                  title: 'Email-уведомления',
                  description: 'Получать уведомления на email',
                },
                {
                  key: 'push' as const,
                  title: 'Push-уведомления',
                  description: 'Push-уведомления в браузере',
                },
                {
                  key: 'digest' as const,
                  title: 'Ежедневный дайджест',
                  description: 'Ежедневная сводка новостей',
                },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch
                    checked={notifications[item.key]}
                    onCheckedChange={(checked) =>
                      setNotifications((p) => ({ ...p, [item.key]: checked }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Внешний вид</CardTitle>
              <CardDescription>Настройка отображения приложения</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Компактный режим</p>
                  <p className="text-xs text-muted-foreground">Уменьшить отступы и размеры</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Анимации</p>
                  <p className="text-xs text-muted-foreground">Анимации переходов</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Безопасность</CardTitle>
              <CardDescription>Управление безопасностью аккаунта</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <Input
                  id="current-password"
                  label="Текущий пароль"
                  type="password"
                />
                <Input
                  id="new-password"
                  label="Новый пароль"
                  type="password"
                />
                <Input
                  id="confirm-password"
                  label="Подтвердите пароль"
                  type="password"
                />
                <Button variant="secondary">
                  <Save className="h-4 w-4" />
                  Изменить пароль
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium text-danger">Опасная зона</p>
                <Button variant="danger" onClick={logout}>
                  Выйти из аккаунта
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
