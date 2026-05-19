import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select';
import { useGenerationStore } from '@shared/stores/generation-store';
import { useSettingsStore } from '@shared/stores/settings-store';
import { useToast } from '@shared/ui/toast';
import { articlesApi, apiPut, apiGet } from '@shared/api/client';
import { SSEStream } from './sse-stream';
import { GenerationResult } from './generation-result';
import { Checkbox } from '@shared/ui/checkbox';
import { Sparkles, Save } from 'lucide-react';

const PAGE_SIZE = 20;
const DEFAULT_TEMPLATE_VALUE = '__default_template__';

function useArticlesForSelection() {
  return useInfiniteQuery({
    queryKey: ['articles-for-generation'],
    queryFn: async ({ pageParam }) => {
      return articlesApi.list({}, pageParam as string | undefined, PAGE_SIZE);
    },
    getNextPageParam: (lastPage) => {
      return lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined;
    },
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
    streamContent,
    isStreaming,
    isGenerating,
    opId,
    streamError,
    setSelectedArticleIds,
    setSelectedTemplateId,
    setSelectedProvider,
    setSelectedModel,
    initFromProvider,
    generatePost,
    startStream,
    resetGeneration,
  } = useGenerationStore();

  const { templates, fetchTemplates } = useSettingsStore();
  const { addToast } = useToast();
  const streamUnsubscribe = useRef<(() => void) | null>(null);

  const [showResult, setShowResult] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    fetchTemplates();
    resetGeneration();
  }, [fetchTemplates, resetGeneration]);

  // Load initial provider/model from active AI provider in DB
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const providers = await apiGet<Array<{ id: string; provider: string; model: string; isActive: boolean }>>('/ai-providers');
        if (cancelled) return;
        const active = Array.isArray(providers) ? providers.find((p) => p.isActive) : null;
        if (active) {
          initFromProvider(active.provider, active.model);
        }
      } catch {
        // Silently ignore — defaults from persisted store will be used
      }
    })();
    return () => { cancelled = true; };
  }, [initFromProvider]);

  useEffect(() => {
    if (opId && !isStreaming && !streamContent) {
      streamUnsubscribe.current = startStream(opId);
      setShowResult(true);
    }
    return () => {
      streamUnsubscribe.current?.();
    };
  }, [opId, isStreaming, streamContent, startStream]);

  const { data, isLoading } = useArticlesForSelection();
  const articles = data?.pages.flatMap((p) => p.data) ?? [];

  const toggleArticle = (id: string) => {
    setSelectedArticleIds(
      selectedArticleIds.includes(id)
        ? selectedArticleIds.filter((a) => a !== id)
        : [...selectedArticleIds, id]
    );
  };

  const handleGenerate = async () => {
    if (selectedArticleIds.length === 0) return;
    resetGeneration();
    setShowResult(false);
    try {
      await generatePost();
    } catch {
      // Error handled by store
    }
  };

  const handleRegenerate = () => {
    resetGeneration();
    setShowResult(false);
    handleGenerate();
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      // Fetch current AI providers and find the one matching the selected provider
      const providers = await apiGet<Array<{ id: string; provider: string; model: string; isActive: boolean }>>('/ai-providers');
      const targetProvider = Array.isArray(providers)
        ? providers.find((p) => p.provider === selectedProvider && p.isActive) ?? providers.find((p) => p.isActive)
        : null;
      if (targetProvider) {
        await apiPut(`/ai-providers/${targetProvider.id}`, {
          model: selectedModel,
        });
        addToast({ title: 'Конфигурация сохранена', description: `Провайдер: ${selectedProvider}, Модель: ${selectedModel}`, variant: 'success' });
      } else {
        addToast({ title: 'Нет активного провайдера', description: 'Добавьте AI провайдер в настройках', variant: 'warning' });
      }
    } catch (err) {
      addToast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось сохранить',
        variant: 'danger',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  if (showResult && (streamContent || streamError)) {
    return (
      <div className="space-y-4">
        <SSEStream content={streamContent} isStreaming={isStreaming} error={streamError} />
        {!isStreaming && streamContent && (
          <GenerationResult
            content={streamContent}
            onRegenerate={handleRegenerate}
          />
        )}
        <Button variant="ghost" onClick={() => { resetGeneration(); setShowResult(false); }}>
          Назад к выбору
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Настройки генерации</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    .filter((t) => t.type === 'post')
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Провайдер</label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Модель</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                  <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                  <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                  <SelectItem value="openrouter/owl-alpha">OpenRouter Owl Alpha</SelectItem>
                  <SelectItem value="openrouter/auto">OpenRouter Auto</SelectItem>
                  <SelectItem value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (via OR)</SelectItem>
                  <SelectItem value="openai/gpt-4o">GPT-4o (via OR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={handleSaveConfig} disabled={savingConfig}>
              <Save className="h-4 w-4 mr-1" />
              {savingConfig ? 'Сохранение...' : 'Сохранить конфигурацию'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            Выберите статьи ({selectedArticleIds.length} выбрано)
          </h3>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={selectedArticleIds.length === 0 || isGenerating}
            loading={isGenerating}
          >
            {!isGenerating && <Sparkles className="h-4 w-4" />}
            Сгенерировать
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg border border-border bg-muted animate-pulse" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <p className="text-sm text-muted-foreground mb-4">Нет доступных статей</p>
              <Button variant="outline" size="sm" onClick={() => navigate({ to: '/feed' })}>
                Перейти в ленту
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {articles.map((article) => (
              <label
                key={article.id}
                className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer transition-colors hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedArticleIds.includes(article.id)}
                  onCheckedChange={() => toggleArticle(article.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium line-clamp-1">{article.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {article.source_name} • {article.published_at ? new Date(article.published_at).toLocaleDateString('ru-RU') : 'без даты'}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
