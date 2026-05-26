import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Skeleton } from '@shared/ui/skeleton';
import { useArticlesStore } from '@shared/stores/articles-store';
import { useGenerationStore } from '@shared/stores/generation-store';
import { ApiError, deepsearchApi, type DeepSearchResult } from '@shared/api/client';
import { useToast } from '@shared/ui/toast';
import {
  ArrowLeft,
  Bookmark,
  ExternalLink,
  Calendar,
  Bot,
  BarChart3,
  Search,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { cn, formatDateTime, cleanArticleText } from '@shared/lib/utils';

interface ArticleDetailProps {
  articleId: string;
}

const scoreColor = (score: number): string => {
  if (score >= 75) return 'bg-success-light text-success';
  if (score >= 50) return 'bg-warning-light text-warning';
  return 'bg-muted text-muted-foreground';
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(score, 100));
}

export function ArticleDetail({ articleId }: ArticleDetailProps) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { setSelectedArticleIds, resetGeneration } = useGenerationStore();
  const { currentArticle, isLoading, fetchArticle, toggleFavorite } = useArticlesStore();
  const [deepSearchResult, setDeepSearchResult] = useState<DeepSearchResult | null>(null);
  const [isDeepSearchStarting, setIsDeepSearchStarting] = useState(false);

  useEffect(() => {
    void fetchArticle(articleId);
  }, [articleId, fetchArticle]);

  useEffect(() => {
    let cancelled = false;

    void deepsearchApi.latestForArticle(articleId)
      .then((result) => {
        if (!cancelled) setDeepSearchResult(result);
      })
      .catch((error) => {
        if (!cancelled && !(error instanceof ApiError && error.status === 404)) {
          setDeepSearchResult(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  useEffect(() => {
    if (!deepSearchResult || !['queued', 'pending', 'running'].includes(deepSearchResult.status)) return;

    const interval = window.setInterval(() => {
      void deepsearchApi.get(deepSearchResult.id)
        .then(setDeepSearchResult)
        .catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [deepSearchResult]);

  if (isLoading && !currentArticle) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!currentArticle) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground">Статья не найдена</p>
        <Button variant="ghost" onClick={() => navigate({ to: '/feed' })} className="mt-4">
          <ArrowLeft className="h-4 w-4" />
          Назад к ленте
        </Button>
      </div>
    );
  }

  const scorePercent = Math.round(clampScore(currentArticle.score));
  const scoreLabel = clampScore(currentArticle.score).toFixed(2);
  const description = cleanArticleText(currentArticle.description || currentArticle.ai_summary || '');
  const content = cleanArticleText(currentArticle.content ?? '');
  const originalDescription = cleanArticleText(currentArticle.original_description ?? '');
  const shouldShowContent =
    Boolean(content)
    && content !== description
    && !(
      currentArticle.language === 'ru'
      && Boolean(description)
      && Boolean(originalDescription)
      && content === originalDescription
    );

  const handleDeepSearch = async () => {
    setIsDeepSearchStarting(true);
    try {
      const result = await deepsearchApi.start({
        article_id: currentArticle.id,
        agent_id: currentArticle.agent_id || undefined,
      });
      const resultId = result.result_id ?? result.op_id;
      if (resultId) {
        setDeepSearchResult({
          id: resultId,
          status: result.status,
          query: currentArticle.title,
          report_text: null,
          error: null,
          created_at: new Date().toISOString(),
          started_at: null,
          finished_at: null,
        });
      }
      addToast({
        title: 'DeepSearch запущен',
        description: `Операция ${result.op_id} уже в работе. Смотри статус-бар и журнал событий.`,
        variant: 'success',
      });
    } catch (error) {
      addToast({
        title: 'Ошибка DeepSearch',
        description: error instanceof Error ? error.message : 'Не удалось запустить DeepSearch',
        variant: 'danger',
      });
    } finally {
      setIsDeepSearchStarting(false);
    }
  };

  const handleGeneratePost = () => {
    resetGeneration();
    setSelectedArticleIds([currentArticle.id]);
    navigate({ to: '/generation' });
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/feed' })} className="-ml-2">
        <ArrowLeft className="h-4 w-4" />
        Лента
      </Button>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-2">
            <CardTitle className="flex-1 text-lg leading-snug">{currentArticle.title}</CardTitle>
            <Badge className={cn('shrink-0 tabular-nums', scoreColor(currentArticle.score))}>{scorePercent}</Badge>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{currentArticle.source_name}</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateTime(currentArticle.published_at)}
            </span>
            {currentArticle.agent_name && (
              <span className="flex items-center gap-1">
                <Bot className="h-3 w-3" />
                {currentArticle.agent_name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              Скор: {scoreLabel}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {description ? (
            <p className="text-sm leading-relaxed text-foreground">{description}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">Краткое превью пока не сформировано.</p>
          )}

          {shouldShowContent && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{content}</div>
          )}

          <div className="grid gap-2 border-t border-border pt-4 sm:flex sm:flex-wrap sm:items-center">
            <Button variant="outline" size="sm" onClick={handleGeneratePost} className="justify-center">
              <Sparkles className="h-4 w-4" />
              Генерация
            </Button>
            <Button
              variant={currentArticle.is_favorite ? 'primary' : 'outline'}
              size="sm"
              onClick={() => toggleFavorite(currentArticle.id)}
              className="justify-center"
            >
              <Bookmark className={cn('h-4 w-4', currentArticle.is_favorite && 'fill-current')} />
              {currentArticle.is_favorite ? 'В избранном' : 'В избранное'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeepSearch} className="justify-center">
              {isDeepSearchStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {deepSearchResult ? 'Обновить DeepSearch' : 'DeepSearch'}
            </Button>
            <a href={currentArticle.url} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="outline" size="sm" className="w-full justify-center">
                <ExternalLink className="h-4 w-4" />
                Открыть оригинал
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {deepSearchResult && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4 text-purple-500" />
                DeepSearch
              </CardTitle>
              <Badge
                variant={
                  deepSearchResult.status === 'completed'
                    ? 'success'
                    : deepSearchResult.status === 'failed'
                      ? 'danger'
                      : 'warning'
                }
              >
                {deepSearchResult.status === 'completed'
                  ? 'Готово'
                  : deepSearchResult.status === 'failed'
                    ? 'Ошибка'
                    : 'В работе'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {deepSearchResult.status === 'completed' && deepSearchResult.report_text ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {deepSearchResult.report_text}
              </div>
            ) : deepSearchResult.status === 'failed' ? (
              <p className="text-sm text-danger">
                {deepSearchResult.error || 'DeepSearch завершился с ошибкой.'}
              </p>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                DeepSearch анализирует статью. Отчёт появится здесь автоматически.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
