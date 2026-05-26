import { useEffect, useState } from 'react';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { Skeleton } from '@shared/ui/skeleton';
import { useToast } from '@shared/ui/toast';
import { deepsearchApi, type DeepSearchWebSearchProvider, type DeepSearchWebSearchSettings } from '@shared/api/client';
import { Save, SearchCheck, TestTube2 } from 'lucide-react';

const PROVIDERS: Array<{ value: DeepSearchWebSearchProvider; label: string }> = [
  { value: 'disabled', label: 'Отключено' },
  { value: 'brave', label: 'Brave Search' },
  { value: 'tavily', label: 'Tavily' },
  { value: 'serpapi', label: 'SerpAPI' },
  { value: 'perplexity', label: 'Perplexity' },
];

const DEFAULT_SETTINGS: DeepSearchWebSearchSettings = {
  provider: 'disabled',
  hasApiKey: false,
  maxResults: 8,
};

function isSettingsPayload(value: unknown): value is DeepSearchWebSearchSettings {
  return Boolean(value && typeof value === 'object' && 'provider' in value);
}

export function DeepSearchSettings() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<DeepSearchWebSearchSettings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    deepsearchApi.getWebSearchSettings()
      .then((value) => {
        if (!cancelled) setSettings(isSettingsPayload(value) ? value : DEFAULT_SETTINGS);
      })
      .catch((error) => {
        addToast({
          title: 'Не удалось загрузить настройки DeepSearch',
          description: error instanceof Error ? error.message : undefined,
          variant: 'danger',
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const payload = (includeKey: boolean): DeepSearchWebSearchSettings => ({
    ...settings,
    apiKey: includeKey && apiKey.trim() ? apiKey.trim() : undefined,
    clearApiKey: settings.provider === 'disabled' ? false : undefined,
  });

  const save = async () => {
    setSaving(true);
    try {
      const updated = await deepsearchApi.updateWebSearchSettings(payload(true));
      setSettings(updated);
      setApiKey('');
      addToast({ title: 'Настройки DeepSearch сохранены', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Не удалось сохранить настройки',
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const result = await deepsearchApi.testWebSearchSettings({
        ...payload(true),
        query: 'OpenAI Anthropic AI news',
      });
      addToast({
        title: result.ok ? 'Подключение работает' : 'Провайдер сохранён',
        description: `${result.message}${typeof result.resultCount === 'number' ? ` · найдено: ${result.resultCount}` : ''}`,
        variant: result.ok ? 'success' : 'default',
      });
    } catch (error) {
      addToast({
        title: 'Тест подключения не прошёл',
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">DeepSearch / внешний поиск</h2>
        <p className="text-sm text-muted-foreground">
          Провайдер здесь ищет внешние источники. AI-провайдер DeepSearch, который пишет отчёт, настраивается отдельно в AI провайдерах.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <SearchCheck className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Внешний web search</CardTitle>
              <CardDescription>
                Brave уже работает. Остальные провайдеры можно сохранить как настройку, подключение для них добавим отдельными адаптерами.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Провайдер</Label>
            <Select
              value={settings.provider}
              onValueChange={(value) => setSettings((current) => ({ ...current, provider: value as DeepSearchWebSearchProvider }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>API key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={settings.hasApiKey ? 'Ключ сохранён. Введи новый, чтобы заменить' : 'Вставь API key'}
              autoComplete="off"
            />
          </div>

          <div className="grid gap-2">
            <Label>Base URL</Label>
            <Input
              value={settings.baseUrl ?? ''}
              onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))}
              placeholder="https://api.search.brave.com/res/v1/web/search"
            />
          </div>

          <div className="grid gap-2">
            <Label>Model ID</Label>
            <Input
              value={settings.model ?? ''}
              onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))}
              placeholder="Для Perplexity или совместимых провайдеров"
            />
          </div>

          <div className="grid gap-2">
            <Label>Максимум источников</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={settings.maxResults}
              onChange={(event) => setSettings((current) => ({ ...current, maxResults: Number(event.target.value) }))}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={test} loading={testing}>
              <TestTube2 className="h-4 w-4" />
              Тест подключения
            </Button>
            <Button onClick={save} loading={saving}>
              <Save className="h-4 w-4" />
              Сохранить
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
