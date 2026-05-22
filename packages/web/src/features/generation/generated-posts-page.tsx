import { useNavigate } from '@tanstack/react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { Skeleton } from '@shared/ui/skeleton';
import { Badge } from '@shared/ui/badge';
import { generationApi } from '@shared/api/client';
import type { GeneratedPost } from '@shared/api/client';
import { FileText, Newspaper, ArrowLeft } from 'lucide-react';
import { cn, formatDateTime } from '@shared/lib/utils';

const PAGE_SIZE = 20;

function useGeneratedPosts() {
  return useInfiniteQuery({
    queryKey: ['generated-posts'],
    queryFn: async ({ pageParam }) => {
      return generationApi.history(pageParam as string | undefined, PAGE_SIZE);
    },
    getNextPageParam: (lastPage) => {
      return lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined;
    },
    initialPageParam: undefined as string | undefined,
    staleTime: 2 * 60 * 1000,
  });
}

export function GeneratedPostsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } = useGeneratedPosts();
  const posts: GeneratedPost[] = data?.pages.flatMap((p) => p.data) ?? [];

  if (isLoading && posts.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate({ to: '/generation' })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">История постов</h1>
          <p className="text-muted-foreground mt-1 text-sm">{posts.length} постов</p>
        </div>
      </div>

      {posts.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light text-accent mb-4">
              <FileText className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold">Нет сгенерированных постов</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6 text-center max-w-sm">
              Сгенерируйте первый пост или дайджест
            </p>
            <Button onClick={() => navigate({ to: '/generation' })}>
              Перейти к генерации
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    post.type === 'post' ? 'bg-primary-light text-primary' : 'bg-warning-light text-warning'
                  )}>
                    {post.type === 'post' ? <FileText className="h-5 w-5" /> : <Newspaper className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {post.type === 'post' ? 'Пост' : 'Дайджест'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(post.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm line-clamp-3 leading-relaxed">
                      {post.content}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{post.provider}</span>
                      <span>•</span>
                      <span>{post.model}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Load more */}
          {hasNextPage && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                loading={isFetchingNextPage}
              >
                Загрузить еще
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <Card className="border-danger/30 bg-danger-light">
          <CardContent className="p-4 text-sm text-danger text-center">
            Ошибка загрузки: {error.message}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
