import { useEffect, useState, useCallback } from 'react';
import { dashboardApi, operationLogsApi, type OperationLog, type PipelineStatus } from '@shared/api/client';
import { Loader2, Play, Search, Sparkles, BarChart3, X, Square, Languages, Brain } from 'lucide-react';
import { cn } from '@shared/lib/utils';

const OPERATION_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  collection: { label: 'Поиск', icon: Play, color: 'text-blue-500' },
  collect_all: { label: 'Поиск', icon: Play, color: 'text-blue-500' },
  fetch_source: { label: 'Поиск', icon: Play, color: 'text-blue-500' },
  collect_agent: { label: 'Поиск', icon: Play, color: 'text-blue-500' },
  scoring: { label: 'Скоринг', icon: BarChart3, color: 'text-amber-500' },
  deepsearch: { label: 'Дипсерч', icon: Search, color: 'text-purple-500' },
  generation: { label: 'Генерация', icon: Sparkles, color: 'text-emerald-500' },
  generate_post: { label: 'Генерация', icon: Sparkles, color: 'text-emerald-500' },
  generate_digest: { label: 'Дайджест', icon: Sparkles, color: 'text-emerald-500' },
  articles_delete_all: { label: 'Очистка', icon: X, color: 'text-rose-500' },
  articles_delete_agent: { label: 'Очистка', icon: X, color: 'text-rose-500' },
  translation: { label: 'Перевод', icon: Languages, color: 'text-cyan-600' },
};

function getOperationInfo(type: string) {
  return OPERATION_LABELS[type] || { label: type, icon: Loader2, color: 'text-gray-500' };
}

function emptyPipeline(): PipelineStatus {
  const q = { waiting: 0, active: 0, delayed: 0, failed: 0 };
  return {
    translating: 0,
    fetched_pending: 0,
    awaiting_analysis: 0,
    awaiting_scoring: 0,
    active_operations: 0,
    is_busy: false,
    queues: { translate: q, ingest: q, scoring: q },
  };
}

export function StatusBar() {
  const [activeOps, setActiveOps] = useState<OperationLog[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStatus>(emptyPipeline());
  const [expanded, setExpanded] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancellingAll, setCancellingAll] = useState(false);

  const fetchActiveOps = useCallback(async () => {
    try {
      const [opsResult, pipelineResult] = await Promise.all([
        operationLogsApi.list(undefined, 20),
        dashboardApi.pipeline().catch(() => emptyPipeline()),
      ]);
      const active = opsResult.data.filter((op) => op.status === 'running' || op.status === 'pending');
      setActiveOps(active);
      setPipeline(pipelineResult);
    } catch {
      // Status bar is non-critical.
    }
  }, []);

  useEffect(() => {
    void fetchActiveOps();
    const interval = setInterval(fetchActiveOps, 5000);
    return () => clearInterval(interval);
  }, [fetchActiveOps]);

  const handleCancel = async (opId: string) => {
    setCancellingId(opId);
    try {
      await operationLogsApi.cancel(opId);
      await fetchActiveOps();
    } catch {
      // Ignore cancel failures in status bar.
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancelAll = async () => {
    setCancellingAll(true);
    try {
      await Promise.all(activeOps.map((op) => operationLogsApi.cancel(op.id)));
      await fetchActiveOps();
    } catch {
      // Ignore cancel failures in status bar.
    } finally {
      setCancellingAll(false);
    }
  };

  const translateJobs =
    (pipeline.queues.translate.active ?? 0) + (pipeline.queues.translate.waiting ?? 0);
  const scoreJobs =
    (pipeline.queues.scoring.active ?? 0) + (pipeline.queues.scoring.waiting ?? 0);
  const ingestJobs =
    (pipeline.queues.ingest.active ?? 0) + (pipeline.queues.ingest.waiting ?? 0);

  const pipelineChips: Array<{ key: string; label: string; count: number; icon: React.ElementType; color: string }> = [];
  if (pipeline.translating > 0 || translateJobs > 0) {
    pipelineChips.push({
      key: 'translate',
      label: 'Перевод',
      count: Math.max(pipeline.translating, translateJobs),
      icon: Languages,
      color: 'text-cyan-600',
    });
  }
  if (pipeline.awaiting_analysis > 0 || ingestJobs > 0) {
    pipelineChips.push({
      key: 'analysis',
      label: 'Саммари',
      count: Math.max(pipeline.awaiting_analysis, ingestJobs),
      icon: Brain,
      color: 'text-violet-600',
    });
  }
  if (pipeline.awaiting_scoring > 0 || scoreJobs > 0) {
    pipelineChips.push({
      key: 'score',
      label: 'Скоринг',
      count: Math.max(pipeline.awaiting_scoring, scoreJobs),
      icon: BarChart3,
      color: 'text-amber-500',
    });
  }

  const hasAnything = activeOps.length > 0 || pipelineChips.length > 0 || pipeline.is_busy;
  if (!hasAnything) return null;

  const summaryMap = new Map<string, number>();
  for (const operation of activeOps) {
    const info = getOperationInfo(operation.operation_type);
    summaryMap.set(info.label, (summaryMap.get(info.label) || 0) + 1);
  }
  for (const chip of pipelineChips) {
    summaryMap.set(chip.label, Math.max(summaryMap.get(chip.label) || 0, chip.count));
  }

  const summaryItems = Array.from(summaryMap.entries());

  return (
    <div className="fixed bottom-[68px] left-0 right-0 z-30 md:bottom-0 md:left-64">
      <div
        className={cn(
          'mx-2 mb-2 rounded-xl border border-cyan-100/80 bg-white/90 shadow-lg shadow-blue-950/10 backdrop-blur-xl transition-all md:mx-4',
          expanded ? 'p-3' : 'px-3 py-2'
        )}
      >
        <div className="flex cursor-pointer items-center gap-3" onClick={() => setExpanded(!expanded)}>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-600" />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {summaryItems.map(([label, count]) => (
              <span key={label} className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                {label}
                {count > 1 ? ` ×${count}` : ''}
              </span>
            ))}
            <span className="text-xs text-muted-foreground">— выполняется</span>
          </div>
          {activeOps.length > 0 && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                void handleCancelAll();
              }}
              disabled={cancellingAll}
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg bg-red-500/90 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              title="Остановить все операции"
            >
              <Square className="h-3 w-3" />
              Стоп всё
            </button>
          )}
        </div>

        {expanded && (
          <div className="mt-2 space-y-1.5">
            {pipelineChips.map((chip) => {
              const Icon = chip.icon;
              return (
                <div key={chip.key} className="flex items-center gap-2 text-xs">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', chip.color)} />
                  <span className="truncate font-medium">{chip.label}</span>
                  <span className="flex-1 truncate text-muted-foreground">
                    {chip.count} статей в обработке агентом
                  </span>
                  <span className="shrink-0 rounded-full bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700">
                    В работе
                  </span>
                </div>
              );
            })}

            {activeOps.map((operation) => {
              const info = getOperationInfo(operation.operation_type);
              const Icon = info.icon;
              const isCancelling = cancellingId === operation.id;

              return (
                <div key={operation.id} className="flex items-center gap-2 text-xs">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', info.color)} />
                  <span className="truncate font-medium">{info.label}</span>
                  {operation.message && (
                    <span className="flex-1 truncate text-muted-foreground">{operation.message}</span>
                  )}
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      operation.status === 'running' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                    )}
                  >
                    {operation.status === 'running' ? 'Выполняется' : 'Ожидание'}
                  </span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleCancel(operation.id);
                    }}
                    disabled={isCancelling}
                    className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-danger-light hover:text-danger disabled:opacity-50"
                    title="Остановить"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
