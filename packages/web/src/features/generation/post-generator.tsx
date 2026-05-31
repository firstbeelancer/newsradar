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
import { Save, Search, Sparkles, X } from 'lucide-react';
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

export function PostGenerator() {
  const navigate = useNavigate();
  const {
    selectedArticleIds,
    selectedArticleSnapshots,
    selectedTemplateId,
    selectedProvider,
    selectedModel,
    isGenerating,
    setSelectedArticles,
    clearSelectedArticles,
    setSelectedTemplateId,
    setSelectedProvider,
    setSelectedModel,
    initFromProvider,
    generatePost,
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
        setSelectedTemplateId(savedGeneration?.postTemplateId ?? null);
      } catch {
        setProviderOptions([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initFromProvider, setSelectedTemplateId]);

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
    for (const article of selectedArticleSnapshots) byId.set(article.id, article);
    for (const query of selectedArticleQueries) {
      if (query.data) byId.set(query.data.id, query.data);
    }
    return selectedArticleIds
      .map((id) => byId.get(id))
      .filter((article): article is Article => Boolean(article));
  }, [selectedArticleIds, selectedArticleQueries, selectedArticleSnapshots]);

  const selectedArticle = selectedArticles[0] ?? null;
  const selectedPostArticleIds = selectedArticle ? [selectedArticle.id] : selectedArticleIds.slice(0, 1);
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
    if (!selectedProvider) return;
    if (modelChoices.length === 0) return;
    if (!modelChoices.some((provider) => provider.model === selectedModel)) {
      setSelectedModel(modelChoices[0].model);
    }
  }, [modelChoices, selectedModel, selectedProvider, setSelectedModel]);

  const handleGenerate = () => {
    if (selectedPostArticleIds.length === 0) return;
    setDialogOpen(true);
    setRequestKey((current) => current + 1);
  };

  const handleKeepOnlyThisArticle = () => {
    if (!selectedArticle) return;
    setSelectedArticles([selectedArticle]);
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
          postTemplateId: selectedTemplateId ?? null,
        },
      } as WorkspaceConfig);
      addToast({
        title: 'Конфигурация сохранена',
        description: `Генерация будет идти через ${targetProvider.name}.`,
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
          <CardTitle className="text-base">Настройки генерации поста</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
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
                    .filter((template) => template.type === 'post')
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
            <h3 className="text-sm font-medium">Новость для поста</h3>
            <p className="text-xs text-muted-foreground">Для поста используется одна выбранная карточка из ленты.</p>
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
            <Button size="sm" onClick={handleGenerate} disabled={selectedPostArticleIds.length === 0 || isGenerating}>
              <Sparkles className="h-4 w-4" />
              Сгенерировать пост
            </Button>
          </div>
        </div>

        {isLoadingSelected && selectedArticles.length === 0 ? (
          <div className="h-20 animate-pulse rounded-lg border border-border bg-muted" />
        ) : !selectedArticle ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <p className="mb-4 text-sm text-muted-foreground">Сначала выбери одну новость в ленте</p>
              <Button variant="outline" size="sm" onClick={() => navigate({ to: '/feed' })}>
                Перейти в ленту
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-3 p-4">
              {selectedArticleIds.length > 1 && (
                <div className="rounded-lg border border-warning/30 bg-warning-light px-3 py-2 text-xs text-warning">
                  Выбрано несколько новостей. Для поста будет использована первая; для всех выбранных используй вкладку «Дайджест».
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{selectedArticle.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selectedArticle.agent_name ? `${selectedArticle.agent_name} • ` : ''}{selectedArticle.source_name} • {selectedArticle.published_at ? new Date(selectedArticle.published_at).toLocaleDateString('ru-RU') : 'без даты'}
                  </p>
                </div>
                {selectedArticleIds.length > 1 ? (
                  <Button variant="outline" size="sm" onClick={handleKeepOnlyThisArticle}>
                    Только она
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon-sm" onClick={clearSelectedArticles} title="Убрать новость">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <GenerationRunDialog
        open={dialogOpen}
        requestKey={requestKey}
        title="Генерация поста"
        description="На выходе будет один готовый текст для Telegram без markdown-мусора."
        idleSummary={`Выбрана новость: ${selectedArticle?.title ?? selectedPostArticleIds[0] ?? 'нет'}.`}
        onOpenChange={setDialogOpen}
        onStart={() => generatePost({ article_ids: selectedPostArticleIds })}
        onRegenerate={(comments) => generatePost({ article_ids: selectedPostArticleIds, custom_prompt: comments })}
      />
    </div>
  );
}
