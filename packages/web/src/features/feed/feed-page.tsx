import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { Skeleton } from '@shared/ui/skeleton';
import { Input } from '@shared/ui/input';
import { useAgentsStore } from '@shared/stores/agents-store';
import { useGenerationStore } from '@shared/stores/generation-store';
import { useToast } from '@shared/ui/toast';
import { articlesApi, deepsearchApi, type Article, type ArticleFilters } from '@shared/api/client';
import { ArticleCard } from './article-card';
import { FeedFilters, type FeedFiltersState } from './feed-filters';
import {
  Newspaper,
  Search,
  Loader2,
  ArrowLeft,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
} from 'lucide-react';

const PAGE_SIZE = 20;

function useArticlesInfinite(filters: ArticleFilters, searchQuery: string) {
  return useInfiniteQuery({
    queryKey: ['articles', filters, searchQuery],
    queryFn: async ({ pageParam }) => {
      if (searchQuery.trim()) {
        return articlesApi.search(searchQuery.trim(), pageParam as string | undefined, PAGE_SIZE);
      }
      return articlesApi.list(filters, pageParam as string | undefined, PAGE_SIZE);
    },
    getNextPageParam: (lastPage) => {
      return lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined;
    },
    initialPageParam: undefined as string | undefined,
    staleTime: 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function FeedPage() {
  const navigate = useNavigate();
  const routeParams = useParams({ strict: false });
  const agentIdFromRoute = (routeParams as Record<string, string> | undefined)?.agentId;

  const queryClient = useQueryClient();
  const { agents, fetchAgents } = useAgentsStore();
  const { setSelectedArticleIds, resetGeneration } = useGenerationStore();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<FeedFiltersState>({
    agentId: agentIdFromRoute ?? '',
    status: '',
    favoritesOnly: false,
    activeChipFilters: [],
  });

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (agentIdFromRoute) {
      setFilters((f) => ({ ...f, agentId: agentIdFromRoute }));
    }
  }, [agentIdFromRoute]);

  const articleFilters: ArticleFilters = {
    agent_id: filters.agentId || undefined,
    status: filters.status || undefined,
    favorites_only: filters.favoritesOnly || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
  };

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useArticlesInfinite(articleFilters, search);

  const articles: Article[] = data?.pages.flatMap((p) => p.data) ?? [];

  // Infinite scroll observer
  const observerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !hasNextPage || isFetchingNextPage) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            fetchNextPage();
          }
        },
        { rootMargin: '200px' }
      );

      observer.observe(node);
      return () => observer.disconnect();
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  const agentName = agents.find((a) => a.id === filters.agentId)?.name;

  const handleDeepSearch = useCallback(async (article: Article) => {
    try {
      const result = await deepsearchApi.start({
        article_id: article.id,
        agent_id: article.agent_id || undefined,
      });
      addToast({
        title: 'DeepSearch запущен',
        description: `Операция ${result.op_id} уже в работе. Смотри статус-бар и раздел генерации.`,
        variant: 'success',
      });
    } catch (error) {
      addToast({
        title: 'Ошибка DeepSearch',
        description: error instanceof Error ? error.message : 'Не удалось запустить DeepSearch',
        variant: 'danger',
      });
    }
  }, [addToast]);

  const handleToggleFavorite = useCallback(async (id: string, isFavorite?: boolean) => {
    const newValue = !(isFavorite ?? false);

    // Optimistic update: instantly flip is_favorite in React Query cache
    queryClient.setQueryData(['articles', articleFilters, search], (old: typeof data) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page: typeof data.pages[0]) => ({
          ...page,
          data: page.data.map((a: Article) =>
            a.id === id ? { ...a, is_favorite: newValue } : a
          ),
        })),
      };
    });

    try {
      if (newValue) {
        await articlesApi.favorite(id);
      } else {
        await articlesApi.unfavorite(id);
      }
    } catch {
      // Rollback on error
      queryClient.setQueryData(['articles', articleFilters, search], (old: typeof data) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: typeof data.pages[0]) => ({
            ...page,
            data: page.data.map((a: Article) =>
              a.id === id ? { ...a, is_favorite: !newValue } : a
            ),
          })),
        };
      });
      addToast({ title: 'Ошибка', description: 'Не удалось изменить избранное', variant: 'danger' });
    }
  }, [articleFilters, search, queryClient, addToast]);

  const handleGeneratePost = useCallback((article: Article) => {
    resetGeneration();
    setSelectedArticleIds([article.id]);
    navigate({ to: '/generation' });
  }, [navigate, resetGeneration, setSelectedArticleIds]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {filters.agentId && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setFilters((f) => ({ ...f, agentId: '' }))}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {agentName ? agentName : 'Лента новостей'}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {articles.length} новостей
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по новостям..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <FeedFilters agents={agents} filters={filters} onChange={setFilters} />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={sortBy === 'date' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              if (sortBy === 'date') {
                setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
              } else {
                setSortBy('date');
                setSortOrder('desc');
              }
            }}
          >
            {sortOrder === 'desc' && sortBy === 'date' ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpWideNarrow className="h-4 w-4" />}
            {sortBy === 'date' && sortOrder === 'desc' ? 'Сначала новые' : sortBy === 'date' && sortOrder === 'asc' ? 'Сначала старые' : 'По дате'}
          </Button>
          <Button
            type="button"
            variant={sortBy === 'score' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              if (sortBy === 'score') {
                setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
              } else {
                setSortBy('score');
                setSortOrder('desc');
              }
            }}
          >
            {sortOrder === 'desc' && sortBy === 'score' ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpWideNarrow className="h-4 w-4" />}
            {sortBy === 'score' && sortOrder === 'desc' ? 'Сначала высокий скор' : sortBy === 'score' && sortOrder === 'asc' ? 'Сначала низкий скор' : 'По скору'}
          </Button>
        </div>
      </div>

      {/* Articles list */}
      {isLoading && articles.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light text-accent mb-4">
              <Newspaper className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold">Нет новостей</h3>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
              {search
                ? `По запросу "${search}" ничего не найдено`
                : filters.agentId
                  ? 'Нет новостей для этого агента'
                  : 'Новости появятся после первого сбора'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onToggleFavorite={handleToggleFavorite}
              onDeepSearch={handleDeepSearch}
              onGeneratePost={handleGeneratePost}
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={observerRef} className="py-4 flex justify-center">
            {isFetchingNextPage && (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
            {!hasNextPage && articles.length > 0 && (
              <p className="text-xs text-muted-foreground">Все новости загружены</p>
            )}
          </div>
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
