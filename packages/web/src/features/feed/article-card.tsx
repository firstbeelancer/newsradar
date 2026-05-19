import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Bookmark, ExternalLink, Calendar, Search, Sparkles } from 'lucide-react';
import { cn, truncate, formatDateTime, cleanArticleText } from '@shared/lib/utils';
import type { Article } from '@shared/api/client';

interface ArticleCardProps {
  article: Article;
  onToggleFavorite: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  selectable?: boolean;
  onDeepSearch?: (article: Article) => void;
  onGeneratePost?: (article: Article) => void;
}

const scoreColor = (score: number): string => {
  if (score >= 75) return 'bg-success-light text-success';
  if (score >= 50) return 'bg-warning-light text-warning';
  return 'bg-muted text-muted-foreground';
};

export function ArticleCard({ article, onToggleFavorite, isSelected, onSelect, selectable, onDeepSearch, onGeneratePost }: ArticleCardProps) {
  const scorePercent = Math.round(article.score);
  const preview = cleanArticleText(
    article.description || article.ai_summary || article.content || article.original_description || ''
  );

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md overflow-hidden',
        selectable && isSelected && 'ring-2 ring-accent'
      )}
      onClick={() => selectable && onSelect?.(article.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-start gap-2">
              <Link
                to="/feed/article/$id"
                params={{ id: article.id }}
                className="text-sm font-medium leading-snug hover:text-accent transition-colors line-clamp-2 flex-1"
                onClick={(e) => selectable && e.preventDefault()}
              >
                {article.title}
              </Link>
              <Badge className={cn('shrink-0 text-[10px]', scoreColor(article.score))}>
                {scorePercent}
              </Badge>
            </div>

            {preview ? (
              <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                {truncate(preview, 180)}
              </p>
            ) : (
              <p className="mt-1.5 text-xs italic text-muted-foreground/80">
                Краткое превью пока не сформировано.
              </p>
            )}

            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              <span className="font-medium">{article.source_name}</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDateTime(article.published_at)}
              </span>
              {article.agent_name && (
                <Badge variant="outline" className="text-[10px]">
                  {article.agent_name}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onGeneratePost?.(article);
              }}
              title="Отправить в генерацию поста"
              className="text-accent border-accent/30 hover:bg-accent/10 gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-xs">Генерация</span>
            </Button>
            <div className="flex flex-row gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeepSearch?.(article);
                }}
                title="Запустить DeepSearch"
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(article.id);
                }}
                className={cn(
                  article.is_favorite && 'text-warning'
                )}
              >
                <Bookmark className={cn('h-4 w-4', article.is_favorite && 'fill-current')} />
              </Button>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <Button variant="ghost" size="icon-sm">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
