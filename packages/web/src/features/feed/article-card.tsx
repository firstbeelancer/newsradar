import { Link } from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import { Card, CardContent } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Bookmark, ExternalLink, Calendar, Search, Sparkles } from 'lucide-react';
import { cn, truncate, formatDateTime, cleanArticleText } from '@shared/lib/utils';
import type { Article } from '@shared/api/client';

interface ArticleCardProps {
  article: Article;
  onToggleFavorite: (id: string, isFavorite?: boolean) => void;
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

function formatScore(score: number): number {
  return Math.round(Math.max(0, Math.min(score, 100)));
}

function isHexColor(value: string | null | undefined): value is string {
  return /^#[0-9a-f]{6}$/i.test(value ?? '');
}

export function getArticleAgentStyle(color: string | null | undefined): CSSProperties | undefined {
  if (!isHexColor(color)) return undefined;
  return {
    '--agent-color': color,
    '--agent-color-soft': `${color}1f`,
    '--agent-color-line': `${color}5c`,
    borderLeftColor: `${color}5c`,
  } as CSSProperties;
}

export function ArticleCard({
  article,
  onToggleFavorite,
  isSelected,
  onSelect,
  selectable,
  onDeepSearch,
  onGeneratePost,
}: ArticleCardProps) {
  const scorePercent = formatScore(article.score);
  const preview = cleanArticleText(article.ai_summary || article.description || article.content || article.original_description || '');
  const agentStyle = getArticleAgentStyle(article.agent_color);

  return (
    <Card
      className={cn(
        'overflow-hidden border-l-[5px] transition-all hover:shadow-md',
        selectable && isSelected && 'ring-2 ring-accent'
      )}
      style={agentStyle}
      onClick={() => selectable && onSelect?.(article.id)}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-start gap-2">
              <Link
                to="/feed/article/$id"
                params={{ id: article.id }}
                className="flex-1 text-sm font-medium leading-snug transition-colors hover:text-accent line-clamp-2"
                onClick={(event) => selectable && event.preventDefault()}
              >
                {article.title}
              </Link>
              <Badge className={cn('shrink-0 text-[10px] tabular-nums', scoreColor(article.score))}>
                {scorePercent}
              </Badge>
            </div>

            {preview ? (
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{truncate(preview, 180)}</p>
            ) : (
              <p className="mt-1.5 text-xs italic text-muted-foreground/80">Краткое превью пока не сформировано.</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="font-medium">{article.source_name}</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDateTime(article.published_at)}
              </span>
              {article.agent_name && (
                <Badge
                  variant="outline"
                  className={cn(
                    'gap-1.5 text-[10px]',
                    agentStyle && 'border-[var(--agent-color-line)] bg-[var(--agent-color-soft)] text-[var(--agent-color)]'
                  )}
                >
                  {agentStyle && <span className="h-1.5 w-1.5 rounded-full bg-[var(--agent-color)]" />}
                  {article.agent_name}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:w-auto sm:min-w-[164px]">
            <Button
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onGeneratePost?.(article);
              }}
              title="Отправить в генерацию поста"
              className="w-full gap-1 border-accent/30 text-accent hover:bg-accent/10"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-xs">Генерация</span>
            </Button>

            <div className="grid grid-cols-3 gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeepSearch?.(article);
                }}
                title="Запустить DeepSearch"
                className="w-full"
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavorite(article.id, article.is_favorite);
                }}
                className={cn('w-full', article.is_favorite && 'text-warning')}
                title={article.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              >
                <Bookmark className={cn('h-4 w-4', article.is_favorite && 'fill-current')} />
              </Button>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="block"
              >
                <Button variant="ghost" size="icon-sm" className="w-full">
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
