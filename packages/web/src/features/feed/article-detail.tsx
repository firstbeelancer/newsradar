import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Skeleton } from '@shared/ui/skeleton';
import { useArticlesStore } from '@shared/stores/articles-store';
import {
  ArrowLeft,
  Bookmark,
  ExternalLink,
  Calendar,
  Bot,
  BarChart3,
} from 'lucide-react';
import { cn, formatDateTime, stripHtml } from '@shared/lib/utils';

interface ArticleDetailProps {
  articleId: string;
}

const scoreColor = (score: number): string => {
  if (score >= 0.8) return 'bg-success-light text-success';
  if (score >= 0.5) return 'bg-warning-light text-warning';
  return 'bg-muted text-muted-foreground';
};

export function ArticleDetail({ articleId }: ArticleDetailProps) {
  const navigate = useNavigate();
  const {
    currentArticle,
    isLoading,
    fetchArticle,
    toggleFavorite,
  } = useArticlesStore();

  useEffect(() => {
    fetchArticle(articleId);
  }, [articleId, fetchArticle]);

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

  const scorePercent = Math.round(currentArticle.score * 100);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: '/feed' })}
        className="-ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Лента
      </Button>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-2">
            <CardTitle className="text-lg leading-snug flex-1">
              {currentArticle.title}
            </CardTitle>
            <Badge className={cn('shrink-0', scoreColor(currentArticle.score))}>
              {scorePercent}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-2">
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
              Скор: {currentArticle.score.toFixed(2)}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {currentArticle.description && (
            <p className="text-sm leading-relaxed text-foreground">
              {stripHtml(currentArticle.description)}
            </p>
          )}

          {currentArticle.content && (
            <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {stripHtml(currentArticle.content)}
            </div>
          )}

          <div className="flex items-center gap-2 pt-4 border-t border-border">
            <Button
              variant={currentArticle.is_favorite ? 'warning' : 'outline'}
              size="sm"
              onClick={() => toggleFavorite(currentArticle.id)}
            >
              <Bookmark className={cn('h-4 w-4', currentArticle.is_favorite && 'fill-current')} />
              {currentArticle.is_favorite ? 'В избранном' : 'В избранное'}
            </Button>
            <a
              href={currentArticle.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4" />
                Открыть оригинал
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
