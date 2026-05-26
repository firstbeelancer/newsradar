import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Skeleton } from '@shared/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { Textarea } from '@shared/ui/textarea';
import { useToast } from '@shared/ui/toast';
import { deepsearchApi, generationApi, type DeepSearchResult, type GeneratedPost } from '@shared/api/client';
import { cn, formatDateTime } from '@shared/lib/utils';
import { Check, Copy, FileSearch, FileText, Newspaper, Save, Trash2 } from 'lucide-react';

const PAGE_SIZE = 20;

function useGeneratedPosts() {
  return useInfiniteQuery({
    queryKey: ['history', 'generated-posts'],
    queryFn: ({ pageParam }) => generationApi.history(pageParam as string | undefined, PAGE_SIZE),
    getNextPageParam: (lastPage) => lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 2 * 60 * 1000,
  });
}

function useDeepSearchHistory() {
  return useInfiniteQuery({
    queryKey: ['history', 'deepsearch'],
    queryFn: ({ pageParam }) => deepsearchApi.list(pageParam as string | undefined, PAGE_SIZE),
    getNextPageParam: (lastPage) => lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 2 * 60 * 1000,
  });
}

function sourceList(result: DeepSearchResult): Array<{ title?: string; url?: string; snippet?: string }> {
  const sources = result.findings?.externalSources;
  return Array.isArray(sources) ? sources as Array<{ title?: string; url?: string; snippet?: string }> : [];
}

export function HistoryPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const postsQuery = useGeneratedPosts();
  const deepSearchQuery = useDeepSearchHistory();
  const posts: GeneratedPost[] = postsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const deepSearchResults: DeepSearchResult[] = deepSearchQuery.data?.pages.flatMap((page) => page.data) ?? [];

  const [selectedPost, setSelectedPost] = useState<GeneratedPost | null>(null);
  const [selectedDeepSearch, setSelectedDeepSearch] = useState<DeepSearchResult | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [deletingDeepSearch, setDeletingDeepSearch] = useState(false);

  const selectedDeepSearchSources = useMemo(
    () => selectedDeepSearch ? sourceList(selectedDeepSearch) : [],
    [selectedDeepSearch]
  );

  useEffect(() => {
    setEditorContent(selectedPost?.content ?? '');
    setCopied(false);
  }, [selectedPost]);

  const openPost = async (post: GeneratedPost) => {
    setSelectedPost(post);
    try {
      setSelectedPost(await generationApi.getPost(post.id));
    } catch {
      setSelectedPost(post);
    }
  };

  const openDeepSearch = async (result: DeepSearchResult) => {
    setSelectedDeepSearch(result);
    try {
      setSelectedDeepSearch(await deepsearchApi.get(result.id));
    } catch {
      setSelectedDeepSearch(result);
    }
  };

  const copyPost = async () => {
    if (!selectedPost) return;
    try {
      await navigator.clipboard.writeText(editorContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast({ title: 'Не удалось скопировать', variant: 'danger' });
    }
  };

  const savePost = async () => {
    if (!selectedPost) return;
    setSaving(true);
    try {
      const updated = await generationApi.updatePost(selectedPost.id, editorContent);
      setSelectedPost(updated);
      await queryClient.invalidateQueries({ queryKey: ['history', 'generated-posts'] });
      addToast({ title: 'Пост сохранён', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Не удалось сохранить пост',
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const deletePost = async () => {
    if (!selectedPost || !window.confirm('Удалить этот пост из истории?')) return;
    setDeletingPost(true);
    try {
      await generationApi.deletePost(selectedPost.id);
      setSelectedPost(null);
      await queryClient.invalidateQueries({ queryKey: ['history', 'generated-posts'] });
      addToast({ title: 'Пост удалён', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Не удалось удалить пост',
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    } finally {
      setDeletingPost(false);
    }
  };

  const deleteDeepSearch = async () => {
    if (!selectedDeepSearch || !window.confirm('Удалить этот отчёт DeepSearch?')) return;
    setDeletingDeepSearch(true);
    try {
      await deepsearchApi.delete(selectedDeepSearch.id);
      setSelectedDeepSearch(null);
      await queryClient.invalidateQueries({ queryKey: ['history', 'deepsearch'] });
      addToast({ title: 'Отчёт DeepSearch удалён', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Не удалось удалить отчёт',
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    } finally {
      setDeletingDeepSearch(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">История</h1>
        <p className="mt-1 text-sm text-muted-foreground">Сгенерированные посты и отчёты DeepSearch в одном месте.</p>
      </div>

      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="posts">Посты</TabsTrigger>
          <TabsTrigger value="deepsearch">DeepSearch</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-3">
          {postsQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24" />)
          ) : posts.length === 0 ? (
            <EmptyState title="Пока нет постов" description="Сгенерированные посты появятся здесь." icon={FileText} />
          ) : (
            posts.map((post) => (
              <button key={post.id} type="button" onClick={() => void openPost(post)} className="block w-full text-left">
                <HistoryCard
                  icon={post.type === 'digest' ? Newspaper : FileText}
                  tone={post.type === 'digest' ? 'warning' : 'primary'}
                  badge={post.type === 'digest' ? 'Дайджест' : 'Пост'}
                  title={post.title || post.content.slice(0, 120)}
                  body={post.content}
                  meta={`${formatDateTime(post.created_at)} · ${post.article_count} статей`}
                />
              </button>
            ))
          )}
          {postsQuery.hasNextPage && (
            <LoadMore loading={postsQuery.isFetchingNextPage} onClick={() => postsQuery.fetchNextPage()} />
          )}
        </TabsContent>

        <TabsContent value="deepsearch" className="space-y-3">
          {deepSearchQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24" />)
          ) : deepSearchResults.length === 0 ? (
            <EmptyState title="Пока нет отчётов DeepSearch" description="Запусти DeepSearch из карточки статьи." icon={FileSearch} />
          ) : (
            deepSearchResults.map((result) => (
              <button key={result.id} type="button" onClick={() => void openDeepSearch(result)} className="block w-full text-left">
                <HistoryCard
                  icon={FileSearch}
                  tone="purple"
                  badge={result.status}
                  title={result.query || String(result.findings?.articleTitle ?? 'DeepSearch')}
                  body={result.report_text || result.error || 'Отчёт ещё формируется.'}
                  meta={`${formatDateTime(result.created_at)} · источников: ${sourceList(result).length}`}
                />
              </button>
            ))
          )}
          {deepSearchQuery.hasNextPage && (
            <LoadMore loading={deepSearchQuery.isFetchingNextPage} onClick={() => deepSearchQuery.fetchNextPage()} />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="max-h-[90vh] w-[96vw] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPost?.title || 'Сгенерированный пост'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea value={editorContent} onChange={(event) => setEditorContent(event.target.value)} rows={18} />
            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="danger" size="sm" onClick={deletePost} loading={deletingPost}>
                <Trash2 className="h-4 w-4" />
                Удалить
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={copyPost}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Скопировано' : 'Копировать'}
                </Button>
                <Button size="sm" onClick={savePost} loading={saving}>
                  <Save className="h-4 w-4" />
                  Сохранить
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDeepSearch} onOpenChange={(open) => !open && setSelectedDeepSearch(null)}>
        <DialogContent className="max-h-[90vh] w-[96vw] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDeepSearch?.query || 'DeepSearch'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{selectedDeepSearch?.status}</Badge>
              {!!selectedDeepSearch && <span className="text-xs text-muted-foreground">{formatDateTime(selectedDeepSearch.created_at)}</span>}
            </div>
            <div className="whitespace-pre-wrap rounded-xl border border-border/60 bg-white/80 p-4 text-sm leading-relaxed">
              {selectedDeepSearch?.report_text || selectedDeepSearch?.error || 'Отчёт ещё формируется.'}
            </div>
            {selectedDeepSearchSources.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Источники</h3>
                {selectedDeepSearchSources.map((source, index) => (
                  <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-border/60 bg-white/70 p-3 text-sm hover:border-accent/40">
                    <span className="font-medium">{source.title || source.url}</span>
                    {source.snippet && <span className="mt-1 block text-xs text-muted-foreground line-clamp-2">{source.snippet}</span>}
                  </a>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="danger" size="sm" onClick={deleteDeepSearch} loading={deletingDeepSearch}>
                <Trash2 className="h-4 w-4" />
                Удалить отчёт
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryCard(props: {
  icon: typeof FileText;
  tone: 'primary' | 'warning' | 'purple';
  badge: string;
  title: string;
  body: string;
  meta: string;
}) {
  const Icon = props.icon;
  return (
    <Card className="transition-all hover:border-accent/40 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              props.tone === 'primary' && 'bg-primary-light text-primary',
              props.tone === 'warning' && 'bg-warning-light text-warning',
              props.tone === 'purple' && 'bg-purple-50 text-purple-600'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{props.badge}</Badge>
              <span className="text-xs text-muted-foreground">{props.meta}</span>
            </div>
            <p className="mt-1 truncate text-sm font-medium">{props.title}</p>
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed">{props.body}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState(props: { title: string; description: string; icon: typeof FileText }) {
  const Icon = props.icon;
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light text-accent">
          <Icon className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold">{props.title}</h3>
        <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">{props.description}</p>
      </CardContent>
    </Card>
  );
}

function LoadMore(props: { loading: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-center py-4">
      <Button variant="outline" size="sm" onClick={props.onClick} loading={props.loading}>
        Загрузить ещё
      </Button>
    </div>
  );
}
