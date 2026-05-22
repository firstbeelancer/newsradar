import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select';
import { Checkbox } from '@shared/ui/checkbox';
import { useGenerationStore } from '@shared/stores/generation-store';
import { useSettingsStore } from '@shared/stores/settings-store';
import { useToast } from '@shared/ui/toast';
import { articlesApi, apiGet, apiPut } from '@shared/api/client';
import { Save, Sparkles } from 'lucide-react';
import { GenerationRunDialog } from './generation-run-dialog';

const PAGE_SIZE = 20;
const DEFAULT_TEMPLATE_VALUE = '__default_template__';

interface AIProviderOption {
  id: string;
  name: string;
  provider: string;
  model: string;
  isActive: boolean;
  assignedTo?: string[];
}

function useArticlesForSelection() {
  return useInfiniteQuery({
    queryKey: ['articles-for-post-generation'],
    queryFn: async ({ pageParam }) => articlesApi.list({}, pageParam as string | undefined, PAGE_SIZE),
    getNextPageParam: (lastPage) => (lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined),
    initialPageParam: undefined as string | undefined,
    staleTime: 2 * 60 * 1000,
  });
}

export function PostGenerator() {
  const navigate = useNavigate();
  const {
    selectedArticleIds,
    selectedTemplateId,
    selectedProvider,
    selectedModel,
    isGenerating,
    setSelectedArticleIds,
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
        const providers = await apiGet<AIProviderOption[]>('/ai-providers');
        if (cancelled) return;

        const generationProviders = (Array.isArray(providers) ? providers : []).filter((provider) => {
          const assignedTo = Array.isArray(provider.assignedTo) ? provider.assignedTo : [];
          return provider.isActive && (assignedTo.length === 0 || assignedTo.includes('generation'));
        });

        setProviderOptions(generationProviders);

        const active = generationProviders[0];
        if (active) {
          initFromProvider(active.provider, active.model);
        }
      } catch {
        setProviderOptions([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initFromProvider]);

  const { data, isLoading } = useArticlesForSelection();
  const articles = data?.pages.flatMap((page) => page.data) ?? [];

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

  const toggleArticle = (id: string) => {
    setSelectedArticleIds(
      selectedArticleIds.includes(id)
        ? selectedArticleIds.filter((articleId) => articleId !== id)
        : [...selectedArticleIds, id]
    );
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
      await apiPut(`/ai-providers/${targetProvider.id}`, {
        model: selectedModel,
        assignedTo: Array.from(new Set([...(targetProvider.assignedTo ?? []), 'generation'])),
      });
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
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Выберите статьи ({selectedArticleIds.length} выбрано)</h3>
          <Button size="sm" onClick={handleGenerate} disabled={selectedArticleIds.length === 0 || isGenerating}>
            <Sparkles className="h-4 w-4" />
            Сгенерировать
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg border border-border bg-muted" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <p className="mb-4 text-sm text-muted-foreground">Нет доступных статей</p>
              <Button variant="outline" size="sm" onClick={() => navigate({ to: '/feed' })}>
                Перейти в ленту
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
            {articles.map((article) => (
              <label
                key={article.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedArticleIds.includes(article.id)}
                  onCheckedChange={() => toggleArticle(article.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{article.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {article.source_name} • {article.published_at ? new Date(article.published_at).toLocaleDateString('ru-RU') : 'без даты'}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <GenerationRunDialog
        open={dialogOpen}
        requestKey={requestKey}
        title="Генерация поста"
        description="На выходе будет один готовый текст для Telegram без markdown-мусора."
        idleSummary={`Выбрано статей: ${selectedArticleIds.length}. Шаблон и модель уже подтянуты из текущих настроек.`}
        onOpenChange={setDialogOpen}
        onStart={() => generatePost({ article_ids: selectedArticleIds })}
        onRegenerate={(comments) => generatePost({ article_ids: selectedArticleIds, custom_prompt: comments })}
      />
    </div>
  );
}
