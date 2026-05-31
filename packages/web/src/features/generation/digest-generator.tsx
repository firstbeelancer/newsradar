import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueries } from '@tanstack/react-query';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select';
import { useGenerationStore } from '@shared/stores/generation-store';
import { useSettingsStore } from '@shared/stores/settings-store';
import { useToast } from '@shared/ui/toast';
import { articlesApi, apiGet, apiPut, workspaceApi, type Article, type WorkspaceConfig } from '@shared/api/client';
import { Newspaper, Save, Search, X } from 'lucide-react';
import { GenerationRunDialog } from './generation-run-dialog';

const DEFAULT_TEMPLATE_VALUE = '__default_template__';

interface AIProviderOption {
  id: string;
  name: string;
  provider: string;
  model: string;
  isActive: boolean;
  assignedTo?: string[];
}

export function DigestGenerator() {
  const navigate = useNavigate();
  const {
    selectedArticleIds,
    selectedArticleSnapshots,
    selectedPeriod,
    selectedTemplateId,
    selectedProvider,
    selectedModel,
    isGenerating,
    setSelectedArticleIds,
    setSelectedArticles,
    clearSelectedArticles,
    setSelectedPeriod,
    setSelectedTemplateId,
    setSelectedProvider,
    setSelectedModel,
    initFromProvider,
    generateDigest,
  } = useGenerationStore();

  const { templates, fetchTemplates } = useSettingsStore();
  const { addToast } = useToast();
  const [providerOptions, setProviderOptions] = useState<AIProviderOption[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [providers, workspace] = await Promise.all([
          apiGet<AIProviderOption[]>('/ai-providers'),
          workspaceApi.get(),
        ]);
        if (cancelled) return;

        const generationProviders = (Array.isArray(providers) ? providers : []).filter((provider) => {
          const assignedTo = Array.isArray(provider.assignedTo) ? provider.assignedTo : [];
          return provider.isActive && assignedTo.includes('generation');
        });

        setProviderOptions(generationProviders);

        const savedGeneration = workspace.config.generation;
        const active = generationProviders.find(
          (provider) => provider.provider === savedGeneration?.provider && provider.model === savedGeneration?.model
        ) ?? generationProviders[0];
        if (active) {
          initFromProvider(active.provider, active.model);
        }
        setSelectedTemplateId(savedGeneration?.digestTemplateId ?? null);
        setSelectedPeriod(savedGeneration?.period ?? 'day');
      } catch {
        setProviderOptions([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initFromProvider, setSelectedPeriod, setSelectedTemplateId]);

  const selectedArticleQueries = useQueries({
    queries: selectedArticleIds.map((id) => ({
      queryKey: ['article', id],
      queryFn: () => articlesApi.get(id),
      enabled: !selectedArticleSnapshots.some((article) => article.id === id),
      staleTime: 2 * 60 * 1000,
    })),
  });

  const selectedArticles = useMemo(() => {
    const byId = new Map<string, Article>();
    for (const article of selectedArticleSnapshots) {
      byId.set(article.id, article);
    }
    for (const query of selectedArticleQueries) {
      if (query.data) byId.set(query.data.id, query.data);
    }
    return selectedArticleIds
      .map((id) => byId.get(id))
      .filter((article): article is Article => Boolean(article));
  }, [selectedArticleIds, selectedArticleQueries, selectedArticleSnapshots]);

  const isLoadingSelected = selectedArticleQueries.some((query) => query.isLoading);

  const providerChoices = useMemo(() => {
    const uniqueProviders = new Map<string, string>();
    for (const provider of providerOptions) {
      if (!uniqueProviders.has(provider.provider)) {
        uniqueProviders.set(provider.provider, provider.name);
      }
    }
    return Array.from(uniqueProviders.entries()).map(([value, label]) => ({ value, label }));
  }, [providerOptions]);

  const modelChoices = useMemo(
    () => providerOptions.filter((provider) => provider.provider === selectedProvider),
    [providerOptions, selectedProvider]
  );

  useEffect(() => {
    if (!selectedProvider || modelChoices.length === 0) return;
    if (!modelChoices.some((provider) => provider.model === selectedModel)) {
      setSelectedModel(modelChoices[0].model);
    }
  }, [modelChoices, selectedModel, selectedProvider, setSelectedModel]);

  const removeArticle = (id: string) => {
    const nextArticles = selectedArticles.filter((article) => article.id !== id);
    if (nextArticles.length > 0 || selectedArticles.length === selectedArticleIds.length) {
      setSelectedArticles(nextArticles);
      return;
    }
    setSelectedArticleIds(selectedArticleIds.filter((articleId) => articleId !== id));
  };

  const handleGenerate = () => {
    if (selectedArticleIds.length === 0) return;
    setDialogOpen(true);
    setRequestKey((current) => current + 1);
  };

  const handleSaveConfig = async () => {
    const targetProvider = providerOptions.find(
      (provider) => provider.provider === selectedProvider && provider.model === selectedModel
    ) ?? providerOptions.find((provider) => provider.provider === selectedProvider)
      ?? providerOptions[0];

    if (!targetProvider) {
      addToast({
        title: 'Нет провайдера для генерации',
        description: 'Сначала настрой AI-провайдера в разделе настроек.',
        variant: 'warning',
      });
      return;
    }

    setSavingConfig(true);
    try {
      const workspace = await workspaceApi.get();
      await apiPut(`/ai-providers/${targetProvider.id}`, {
        model: selectedModel,
        assignedTo: Array.from(new Set([...(targetProvider.assignedTo ?? []), 'generation'])),
      });
      await workspaceApi.updateConfig({
        ...workspace.config,
        generation: {
          ...(workspace.config.generation ?? {}),
          provider: targetProvider.provider,
          model: selectedModel,
          digestTemplateId: selectedTemplateId ?? null,
          period: selectedPeriod,
        },
      } as WorkspaceConfig);
      addToast({
        title: 'Конфигурация сохранена',
        description: `Дайджест будет собираться через ${targetProvider.name}.`,
        variant: 'success',
      });
    } catch (error) {
      addToast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось сохранить конфигурацию',
        variant: 'danger',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Настройки генерации дайджеста</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium">Шаблон</label>
              <Select
                value={selectedTemplateId ?? DEFAULT_TEMPLATE_VALUE}
                onValueChange={(value) => setSelectedTemplateId(value === DEFAULT_TEMPLATE_VALUE ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="По умолчанию" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_TEMPLATE_VALUE}>По умолчанию</SelectItem>
                  {templates
                    .filter((template) => template.type === 'digest')
                    .map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Провайдер</label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Выбери провайдера" />
                </SelectTrigger>
                <SelectContent>
                  {providerChoices.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Модель</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Выбери модель" />
                </SelectTrigger>
                <SelectContent>
                  {modelChoices.map((provider) => (
                    <SelectItem key={`${provider.id}:${provider.model}`} value={provider.model}>
                      {provider.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Период</label>
              <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as 'day' | 'week' | 'month')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">День</SelectItem>
                  <SelectItem value="week">Неделя</SelectItem>
                  <SelectItem value="month">Месяц</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={handleSaveConfig} disabled={savingConfig || providerOptions.length === 0}>
              <Save className="mr-1 h-4 w-4" />
              {savingConfig ? 'Сохраняю...' : 'Сохранить конфигурацию'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium">Статьи для дайджеста ({selectedArticleIds.length} выбрано)</h3>
            <p className="text-xs text-muted-foreground">Отбирай новости в ленте через поиск, канал, агента и чипы.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate({ to: '/feed' })}>
              <Search className="h-4 w-4" />
              Выбрать в ленте
            </Button>
            {selectedArticleIds.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelectedArticles}>
                <X className="h-4 w-4" />
                Очистить
              </Button>
            )}
            <Button size="sm" onClick={handleGenerate} disabled={selectedArticleIds.length === 0 || isGenerating}>
              <Newspaper className="h-4 w-4" />
              Сгенерировать дайджест
            </Button>
          </div>
        </div>

        {isLoadingSelected && selectedArticles.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg border border-border bg-muted" />
            ))}
          </div>
        ) : selectedArticleIds.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <p className="mb-4 text-sm text-muted-foreground">Сначала выбери новости для дайджеста в ленте</p>
              <Button variant="outline" size="sm" onClick={() => navigate({ to: '/feed' })}>
                Перейти в ленту
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {selectedArticles.map((article) => (
              <div
                key={article.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-white/70 p-3 transition-colors hover:bg-white"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{article.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {article.agent_name ? `${article.agent_name} • ` : ''}{article.source_name} • {article.published_at ? new Date(article.published_at).toLocaleDateString('ru-RU') : 'без даты'}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => removeArticle(article.id)} title="Убрать из дайджеста">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {selectedArticles.length < selectedArticleIds.length && (
              <p className="text-xs text-muted-foreground">
                Часть выбранных новостей ещё загружается: {selectedArticleIds.length - selectedArticles.length}
              </p>
            )}
          </div>
        )}
      </div>

      <GenerationRunDialog
        open={dialogOpen}
        requestKey={requestKey}
        title="Генерация дайджеста"
        description="На выходе будет один готовый текст для Telegram без markdown-мусора."
        idleSummary={`Выбрано статей: ${selectedArticleIds.length}. Период: ${selectedPeriod}.`}
        onOpenChange={setDialogOpen}
        onStart={() => generateDigest()}
        onRegenerate={(comments) => generateDigest({ custom_prompt: comments })}
      />
    </div>
  );
}
