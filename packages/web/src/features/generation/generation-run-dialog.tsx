import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { useGenerationStore } from '@shared/stores/generation-store';
import { Loader2, Sparkles } from 'lucide-react';
import { SSEStream } from './sse-stream';
import { GenerationResult } from './generation-result';

interface GenerationRunDialogProps {
  open: boolean;
  requestKey: number;
  title: string;
  description: string;
  idleSummary?: string;
  onOpenChange: (open: boolean) => void;
  onStart: () => Promise<void>;
  onRegenerate: () => Promise<void> | void;
}

export function GenerationRunDialog({
  open,
  requestKey,
  title,
  description,
  idleSummary,
  onOpenChange,
  onStart,
  onRegenerate,
}: GenerationRunDialogProps) {
  const {
    opId,
    streamContent,
    streamError,
    error,
    isGenerating,
    isStreaming,
    startStream,
    resetGeneration,
  } = useGenerationStore();

  const startedRequestRef = useRef<number>(0);
  const subscribedOpRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open || requestKey === 0 || startedRequestRef.current === requestKey) return;

    startedRequestRef.current = requestKey;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    subscribedOpRef.current = null;
    resetGeneration();

    void onStart();
  }, [open, onStart, requestKey, resetGeneration]);

  useEffect(() => {
    if (!open || !opId || subscribedOpRef.current === opId) return;

    unsubscribeRef.current?.();
    unsubscribeRef.current = startStream(opId);
    subscribedOpRef.current = opId;
  }, [open, opId, startStream]);

  useEffect(() => {
    if (open) return;

    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    subscribedOpRef.current = null;
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          subscribedOpRef.current = null;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="w-[96vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!opId && !streamContent && !streamError && (
          <Card className="border-accent/20 bg-accent-light/30">
            <CardContent className="flex items-center gap-3 py-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white">
                {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {isGenerating ? 'Запускаю генерацию...' : 'Готовлю запрос к модели'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {idleSummary ?? 'Проверяю выбранный шаблон, новости и активный AI-провайдер.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {(opId || streamContent || streamError || error) && (
          <div className="space-y-4">
            <SSEStream content={streamContent} isStreaming={isStreaming} error={streamError ?? error ?? null} />

            {!isStreaming && !!streamContent && (
              <GenerationResult content={streamContent} onRegenerate={() => void onRegenerate()} />
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
