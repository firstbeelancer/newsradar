import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@shared/api/client';
import { useAuthStore } from '@shared/stores/auth-store';
import { Card, CardContent } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Badge } from '@shared/ui/badge';
import { cn } from '@shared/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/ui/select';
import { Switch } from '@shared/ui/switch';
import { Label } from '@shared/ui/label';
import { Skeleton } from '@shared/ui/skeleton';
import { useToast } from '@shared/ui/toast';
import {
  Cpu,
  Plus,
  Trash2,
  Check,
  Pencil,
  Zap,
  Globe,
  TestTube2,
  XCircle,
  X,
  Save,
} from 'lucide-react';
import { GrokOauthCard } from './grok-oauth-card';

// ─── Types ───────────────────────────────────────────────────────────────────

type ProviderSlug = 'openai' | 'anthropic' | 'openrouter' | 'google' | 'xai';
type ProviderMode = 'platform' | 'byok' | 'oauth';

interface AIProvider {
  id: string;
  name: string;
  type: ProviderMode;
  provider: ProviderSlug;
  baseUrl?: string;
  hasKey?: boolean;
  model: string;
  isActive: boolean;
  assignedTo?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface ProviderFormData {
  name: string;
  type: ProviderMode;
  provider: ProviderSlug;
  baseUrl: string;
  apiKey: string;
  model: string;
  isActive: boolean;
  assignedTo: string[];
}

interface TestResult {
  success: boolean;
  message?: string;
}

const PROCESS_OPTIONS = [
  { value: 'search', label: 'Сбор / Поиск' },
  { value: 'translation', label: 'Перевод' },
  { value: 'scoring', label: 'Скоринг' },
  { value: 'generation', label: 'Генерация' },
  { value: 'deepsearch', label: 'Глубокий поиск' },
];

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_BASE_URLS: Record<ProviderSlug, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  google: 'https://generativelanguage.googleapis.com/v1',
  xai: 'https://api.x.ai/v1',
};

const PROVIDER_LABELS: Record<ProviderSlug, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  google: 'Google AI',
  xai: 'xAI / Grok',
};

const EMPTY_FORM: ProviderFormData = {
  name: '',
  type: 'byok',
  provider: 'openrouter',
  baseUrl: DEFAULT_BASE_URLS.openrouter,
  apiKey: '',
  model: '',
  isActive: true,
  assignedTo: [],
};

// ─── Component ───────────────────────────────────────────────────────────────

export function AIProvidersSettings() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [form, setForm] = useState<ProviderFormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { addToast } = useToast();
  const workspaceId = useAuthStore((s) => s.workspace_id);

  // ─── Fetch providers ─────────────────────────────────────────────────────

  const fetchProviders = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await apiGet<AIProvider[]>('/ai-providers');
      // Normalize: ensure assignedTo is always an array (backend field is assigned_to)
      const normalized = (Array.isArray(data) ? data : []).map((p) => {
        const raw = p as unknown as Record<string, unknown>;
        return {
          ...p,
          assignedTo: (raw.assignedTo ?? raw.assigned_to ?? []) as string[],
        };
      });
      setProviders(normalized);
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // ─── Dialog helpers ──────────────────────────────────────────────────────

  const openAddDialog = () => {
    setEditingProvider(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEditDialog = (provider: AIProvider) => {
    setEditingProvider(provider);
    setForm({
      name: provider.name,
      type: provider.type,
      provider: provider.provider,
      baseUrl: provider.baseUrl || DEFAULT_BASE_URLS[provider.provider],
      apiKey: '',
      model: provider.model,
      isActive: provider.isActive,
      assignedTo: provider.assignedTo || [],
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingProvider(null);
    setForm({ ...EMPTY_FORM });
  };

  // ─── Provider type change ────────────────────────────────────────────────

  const handleProviderChange = (slug: ProviderSlug) => {
    setForm((prev) => ({
      ...prev,
      provider: slug,
      baseUrl: DEFAULT_BASE_URLS[slug],
      name: prev.name || PROVIDER_LABELS[slug],
    }));
  };

  // ─── Save ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim() || !form.apiKey.trim() || !form.model.trim()) {
      addToast({
        title: 'Заполните обязательные поля',
        description: 'Название, API-ключ и модель обязательны',
        variant: 'warning',
      });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        provider: form.provider,
        baseUrl: form.baseUrl.trim() || undefined,
        apiKey: form.apiKey.trim(),
        model: form.model.trim(),
        isActive: form.isActive,
        assignedTo: form.assignedTo,
      };

      if (editingProvider) {
        await apiPut<AIProvider, typeof payload>(
          `/ai-providers/${editingProvider.id}`,
          payload
        );
        addToast({ title: 'Провайдер обновлён', variant: 'success' });
      } else {
        await apiPost<AIProvider, typeof payload>('/ai-providers', payload);
        addToast({ title: 'Провайдер добавлен', variant: 'success' });
      }

      closeDialog();
      fetchProviders();
    } catch (err) {
      addToast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось сохранить',
        variant: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiDelete<void>(`/ai-providers/${id}`);
      addToast({ title: 'Провайдер удалён', variant: 'success' });
      fetchProviders();
    } catch (err) {
      addToast({
        title: 'Ошибка удаления',
        description: err instanceof Error ? err.message : '',
        variant: 'danger',
      });
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Test connection ─────────────────────────────────────────────────────

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    try {
      const result = await apiPost<TestResult>(`/ai-providers/${id}/test`, {});
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: result.success, message: result.message },
      }));
      addToast({
        title: result.success ? 'Подключение успешно' : 'Подключение не удалось',
        description: result.message,
        variant: result.success ? 'success' : 'danger',
      });
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, message: err instanceof Error ? err.message : 'Ошибка' },
      }));
    } finally {
      setTestingId(null);
    }
  };

  // ─── Inline process assignment save ──────────────────────────────────────

  const handleSaveAssignments = async (provider: AIProvider) => {
    try {
      await apiPut<AIProvider, Partial<AIProvider>>(`/ai-providers/${provider.id}`, {
        assignedTo: provider.assignedTo || [],
      });
      addToast({ title: 'Конфигурация сохранена', variant: 'success' });
    } catch (err) {
      addToast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось сохранить',
        variant: 'danger',
      });
    }
  };

  // ─── Toggle active ──────────────────────────────────────────────────────

  const handleToggleActive = async (provider: AIProvider) => {
    try {
      await apiPut<AIProvider, Partial<AIProvider>>(`/ai-providers/${provider.id}`, {
        isActive: !provider.isActive,
      });
      fetchProviders();
    } catch (err) {
      addToast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : '',
        variant: 'danger',
      });
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">AI провайдеры</h2>
          <p className="text-sm text-muted-foreground">
            Управление подключениями к AI-сервисам для генерации контента
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                for (const p of providers) {
                  await apiPut<AIProvider, Partial<AIProvider>>(`/ai-providers/${p.id}`, {
                    assignedTo: p.assignedTo || [],
                    isActive: p.isActive,
                  });
                }
                addToast({ title: 'Конфигурация сохранена', description: `Сохранено ${providers.length} провайдеров`, variant: 'success' });
              } catch (err) {
                addToast({ title: 'Ошибка', description: err instanceof Error ? err.message : '', variant: 'danger' });
              }
            }}
            disabled={providers.length === 0}
          >
            <Save className="h-4 w-4 mr-1" />
            Сохранить всё
          </Button>
          <Button onClick={openAddDialog} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Добавить
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && <GrokOauthCard onConnected={fetchProviders} />}

      {!loading && providers.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Cpu className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Нет подключённых провайдеров
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Добавьте AI-провайдер для генерации контента
            </p>
            <Button onClick={openAddDialog} variant="outline" size="sm" className="mt-4">
              <Plus className="h-4 w-4 mr-1" />
              Добавить провайдер
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && providers.length > 0 && (
        <div className="space-y-3">
          {/* Сводка: какой провайдер сейчас реально обслуживает каждый процесс.
              Если ни один не назначен явно, worker выберет:
              • единственный активный провайдер — на все процессы;
              • если активных несколько — упадёт на env-fallback (PLATFORM_AI_MODEL). */}
          <Card className="bg-muted/40">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <p className="text-sm font-semibold">Активные назначения процессов</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Эти провайдеры сейчас вызываются в worker для соответствующего шага пайплайна.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
                {PROCESS_OPTIONS.map((proc) => {
                  const activeProviders = providers.filter(
                    (p) => p.isActive && (p.assignedTo || []).includes(proc.value),
                  );
                  const activeCount = providers.filter((p) => p.isActive).length;
                  const soleActiveProvider =
                    activeCount === 1 ? providers.find((p) => p.isActive) : null;
                  const effectiveProvider =
                    activeProviders.length > 0
                      ? activeProviders[0]
                      : soleActiveProvider ?? null;
                  return (
                    <div
                      key={proc.value}
                      className="rounded-md border border-border/60 bg-background px-3 py-2"
                    >
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{proc.label}</p>
                      {effectiveProvider ? (
                        <p className="text-sm font-medium truncate mt-0.5">
                          {effectiveProvider.name}
                          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                            · {effectiveProvider.model}
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-warning mt-0.5">
                          ⚠️ нет активного провайдера (будет env-fallback)
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {providers.map((provider) => {
            const assignedProcesses = provider.assignedTo || [];
            const isUnassigned = assignedProcesses.length === 0;
            const isSoleActive = providers.filter((p) => p.isActive).length === 1 && provider.isActive;
            const testResult = testResults[provider.id];
            const isTesting = testingId === provider.id;
            const isDeleting = deletingId === provider.id;

            return (
              <Card key={provider.id} className="hover:shadow-md transition-all overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent">
                        <Cpu className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{provider.name}</p>
                          <Badge variant={provider.isActive ? 'success' : 'default'} className="text-[10px] shrink-0">
                            {provider.isActive ? 'Активен' : 'Выключен'}
                          </Badge>
                          <Badge variant="default" className="text-[10px] shrink-0">
                            {PROVIDER_LABELS[provider.provider] || provider.provider}
                          </Badge>
                          {/* Предупреждение о неоднозначности: провайдер активен, но не назначен ни на один процесс,
                              при этом есть другие активные провайдеры. Worker упадёт на env-fallback, и в OpenRouter
                              прилетит модель не из этого провайдера. */}
                          {isUnassigned && providers.filter((p) => p.isActive).length > 1 && (
                            <Badge variant="warning" className="text-[10px] shrink-0" title="Провайдер активен, но не назначен ни на один процесс. Worker будет использовать другой провайдер или env-fallback.">
                              не назначен
                            </Badge>
                          )}
                          {/* Если это единственный активный провайдер, worker автоматически назначит его на все процессы (backfillLegacyAssignments). */}
                          {isUnassigned && isSoleActive && (
                            <Badge variant="default" className="text-[10px] shrink-0" title="Единственный активный провайдер — worker автоматически использует его для всех процессов.">
                              авто-назначение
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <Globe className="h-3 w-3 shrink-0" />
                          <span className="truncate">{provider.model}</span>
                        </div>
                        {provider.baseUrl && (
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <Zap className="h-3 w-3 shrink-0" />
                            <span className="truncate">{provider.baseUrl}</span>
                          </div>
                        )}
                        {/* Assigned processes — always visible */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground mr-0.5">Процессы:</span>
                          {PROCESS_OPTIONS.map((proc) => {
                            const isAssigned = (provider.assignedTo || []).includes(proc.value);
                            return (
                              <button
                                key={proc.value}
                                type="button"
                                onClick={() => {
                                  setProviders((prev) =>
                                    prev.map((p) =>
                                      p.id === provider.id
                                        ? {
                                            ...p,
                                            assignedTo: isAssigned
                                              ? (p.assignedTo || []).filter((v) => v !== proc.value)
                                              : [...(p.assignedTo || []), proc.value],
                                          }
                                        : p
                                    )
                                  );
                                }}
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all',
                                  isAssigned
                                    ? 'border-accent bg-accent/10 text-accent'
                                    : 'border-border/50 text-muted-foreground/60 hover:bg-muted'
                                )}
                              >
                                {proc.label}
                              </button>
                            );
                          })}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px]"
                            onClick={() => handleSaveAssignments(provider)}
                            title="Сохранить назначения"
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                        </div>
                        {testResult && (
                          <div className="mt-1 flex items-center gap-1">
                            {testResult.success ? (
                              <Check className="h-3 w-3 text-success shrink-0" />
                            ) : (
                              <XCircle className="h-3 w-3 text-danger shrink-0" />
                            )}
                            <span className={`text-xs ${testResult.success ? 'text-success' : 'text-danger'}`}>
                              {testResult.message || (testResult.success ? 'OK' : 'Ошибка')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor={`active-${provider.id}`} className="text-xs text-muted-foreground cursor-pointer">
                        Вкл
                      </Label>
                      <Switch
                        id={`active-${provider.id}`}
                        checked={provider.isActive}
                        onCheckedChange={() => handleToggleActive(provider)}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleTest(provider.id)} disabled={isTesting} title="Проверить">
                        <TestTube2 className={`h-4 w-4 ${isTesting ? 'animate-pulse' : ''}`} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(provider)} title="Редактировать">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(provider.id)} disabled={isDeleting} title="Удалить">
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <DialogTitle>
              {editingProvider ? 'Редактировать провайдер' : 'Добавить провайдер'}
            </DialogTitle>
            <Button variant="ghost" size="icon-sm" onClick={closeDialog} aria-label="Закрыть настройки провайдера">
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Провайдер</Label>
              <Select value={form.provider} onValueChange={(v) => handleProviderChange(v as ProviderSlug)}>
                <SelectTrigger><SelectValue placeholder="Выберите провайдер" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROVIDER_LABELS) as ProviderSlug[]).map((slug) => (
                    <SelectItem key={slug} value={slug}>{PROVIDER_LABELS[slug]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Тип подключения</Label>
              <Select value={form.type} onValueChange={(v) => setForm((prev) => ({ ...prev, type: v as ProviderMode }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform">Платформенный</SelectItem>
                  <SelectItem value="byok">Свой ключ (BYOK)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Название</Label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Мой OpenRouter" />
            </div>
            <div className="space-y-1.5">
              <Label>Base URL</Label>
              <Input value={form.baseUrl} onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))} placeholder={DEFAULT_BASE_URLS[form.provider]} />
              <p className="text-xs text-muted-foreground">Оставьте по умолчанию или укажите кастомный URL</p>
            </div>
            <div className="space-y-1.5">
              <Label>API ключ</Label>
              <Input type="password" value={form.apiKey} onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))} placeholder="sk-..." />
              <p className="text-xs text-muted-foreground">Ключ хранится в зашифрованном виде</p>
            </div>
            <div className="space-y-1.5">
              <Label>Модель</Label>
              <Input value={form.model} onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))} placeholder="grok-3-mini / openrouter/auto" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Активен</Label>
                <p className="text-xs text-muted-foreground">Включить провайдер для использования</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
            </div>

            <div className="space-y-2">
              <Label>Назначить на процессы</Label>
              <p className="text-xs text-muted-foreground">Выберите, для каких процессов использовать этого провайдера</p>
              <div className="flex flex-wrap gap-2">
                {PROCESS_OPTIONS.map((proc) => {
                  const isActive = form.assignedTo.includes(proc.value);
                  return (
                    <button
                      key={proc.value}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          assignedTo: isActive
                            ? prev.assignedTo.filter((p) => p !== proc.value)
                            : [...prev.assignedTo, proc.value],
                        }));
                      }}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                        isActive
                          ? 'border-accent bg-accent-light text-accent'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {proc.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Закрыть</Button>
            <Button variant="ghost" onClick={closeDialog}>Отмена</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.apiKey.trim() || !form.model.trim()}>
              {saving ? 'Сохранение...' : editingProvider ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
