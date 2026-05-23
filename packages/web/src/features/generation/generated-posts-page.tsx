import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { Skeleton } from '@shared/ui/skeleton';
import { Badge } from '@shared/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Textarea } from '@shared/ui/textarea';
import { useToast } from '@shared/ui/toast';
import { useGenerationStore } from '@shared/stores/generation-store';
import { generationApi } from '@shared/api/client';
import type { GeneratedPost } from '@shared/api/client';
import { ArrowLeft, Check, Copy, FileText, Newspaper, RotateCcw, Save, Trash2 } from 'lucide-react';
import { cn, formatDateTime } from '@shared/lib/utils';
import { GenerationRunDialog } from './generation-run-dialog';

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
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { generatePost, generateDigest } = useGenerationStore();
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } = useGeneratedPosts();
  const posts: GeneratedPost[] = data?.pages.flatMap((p) => p.data) ?? [];

  const [selectedPost, setSelectedPost] = useState<GeneratedPost | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [regenRequestKey, setRegenRequestKey] = useState(0);

  const selectedArticleIds = useMemo(() => selectedPost?.article_ids ?? [], [selectedPost]);
  const canRegenerate = selectedPost?.type !== 'deepsearch' && selectedArticleIds.length > 0;

  useEffect(() => {
    setEditorContent(selectedPost?.content ?? '');
    setCopied(false);
  }, [selectedPost]);

  const invalidateHistory = async () => {
    await queryClient.invalidateQueries({ queryKey: ['generated-posts'] });
  };

  const openPost = async (post: GeneratedPost) => {
    setSelectedPost(post);
    try {
      const freshPost = await generationApi.getPost(post.id);
      setSelectedPost(freshPost);
    } catch {
      setSelectedPost(post);
    }
  };

  const handleCopy = async () => {
    if (!selectedPost) return;
    try {
      await navigator.clipboard.writeText(editorContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast({ title: 'Не удалось скопировать', variant: 'danger' });
    }
  };

  const handleSave = async () => {
    if (!selectedPost) return;
    setSaving(true);
    try {
      const updated = await generationApi.updatePost(selectedPost.id, editorContent);
      setSelectedPost(updated);
      await invalidateHistory();
      addToast({ title: 'Пост сохранён', variant: 'success' });
    } catch (err) {
      addToast({
        title: 'Не удалось сохранить',
        description: err instanceof Error ? err.message : undefined,
        variant: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPost) return;
    if (!window.confirm('Удалить этот сгенерированный пост?')) return;

    setDeleting(true);
    try {
      await generationApi.deletePost(selectedPost.id);
      setSelectedPost(null);
      await invalidateHistory();
      addToast({ title: 'Пост удалён', variant: 'success' });
    } catch (err) {
      addToast({
        title: 'Не удалось удалить',
        description: err instanceof Error ? err.message : undefined,
        variant: 'danger',
      });
    } finally {
      setDeleting(false);
    }
  };

  const startRegenerate = () => {
    if (!selectedPost || !canRegenerate) return;
    setRegenDialogOpen(true);
    setRegenRequestKey((current) => current + 1);
  };

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
          <p className="mt-1 text-sm text-muted-foreground">{posts.length} постов</p>
        </div>
      </div>

      {posts.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light text-accent">
              <FileText className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold">Нет сгенерированных постов</h3>
            <p className="mb-6 mt-1 max-w-sm text-center text-sm text-muted-foreground">
              Сгенерируй первый пост или дайджест
            </p>
            <Button onClick={() => navigate({ to: '/generation' })}>
              Перейти к генерации
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => void openPost(post)}
              className="block w-full text-left"
            >
              <Card className="transition-all hover:border-accent/40 hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      post.type === 'post' ? 'bg-primary-light text-primary' : 'bg-warning-light text-warning'
                    )}>
                      {post.type === 'post' ? <FileText className="h-5 w-5" /> : <Newspaper className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {post.type === 'post' ? 'Пост' : 'Дайджест'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(post.created_at)}
                        </span>
                      </div>
                      {post.title && <p className="mt-1 truncate text-sm font-medium">{post.title}</p>}
                      <p className="mt-1 line-clamp-3 text-sm leading-relaxed">
                        {post.content}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{post.provider}</span>
                        <span>•</span>
                        <span>{post.model}</span>
                        {post.article_count > 0 && (
                          <>
                            <span>•</span>
                            <span>{post.article_count} статей</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}

          {hasNextPage && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                loading={isFetchingNextPage}
              >
                Загрузить ещё
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <Card className="border-danger/30 bg-danger-light">
          <CardContent className="p-4 text-center text-sm text-danger">
            Ошибка загрузки: {error.message}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="max-h-[90vh] w-[96vw] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPost?.title || 'Сгенерированный пост'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{selectedPost?.type === 'digest' ? 'Дайджест' : 'Пост'}</Badge>
              {selectedPost && <span>{formatDateTime(selectedPost.created_at)}</span>}
              {!!selectedPost?.article_count && <span>{selectedPost.article_count} статей</span>}
            </div>

            <Textarea
              value={editorContent}
              onChange={(event) => setEditorContent(event.target.value)}
              rows={18}
              className="resize-none text-sm leading-relaxed"
            />

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
                <Trash2 className="h-4 w-4" />
                Удалить
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Скопировано' : 'Копировать'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleSave} loading={saving}>
                  <Save className="h-4 w-4" />
                  Сохранить
                </Button>
                <Button size="sm" onClick={startRegenerate} disabled={!canRegenerate}>
                  <RotateCcw className="h-4 w-4" />
                  Перегенерировать
                </Button>
              </div>
            </div>
            {!canRegenerate && (
              <p className="text-xs text-muted-foreground">
                Перегенерация недоступна для этой старой записи: в истории нет списка исходных статей.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedPost && (
        <GenerationRunDialog
          open={regenDialogOpen}
          requestKey={regenRequestKey}
          title="Перегенерация поста"
          description="Создаю новую версию на основе исходных статей из истории."
          idleSummary={`Исходных статей: ${selectedArticleIds.length}.`}
          onOpenChange={setRegenDialogOpen}
          onStart={() =>
            selectedPost.type === 'digest'
              ? generateDigest({
                  article_ids: selectedArticleIds,
                  agent_id: selectedPost.agent_id ?? undefined,
                  template_id: selectedPost.template_id ?? undefined,
                })
              : generatePost({
                  article_ids: selectedArticleIds,
                  template_id: selectedPost.template_id ?? undefined,
                })
          }
          onRegenerate={(comments) =>
            selectedPost.type === 'digest'
              ? generateDigest({
                  article_ids: selectedArticleIds,
                  agent_id: selectedPost.agent_id ?? undefined,
                  template_id: selectedPost.template_id ?? undefined,
                  custom_prompt: comments,
                })
              : generatePost({
                  article_ids: selectedArticleIds,
                  template_id: selectedPost.template_id ?? undefined,
                  custom_prompt: comments,
                })
          }
        />
      )}
    </div>
  );
}
