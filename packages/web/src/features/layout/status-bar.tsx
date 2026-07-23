import { useEffect, useState, useCallback } from 'react';
import { dashboardApi, operationLogsApi, type OperationLog, type PipelineStatus } from '@shared/api/client';
import { Loader2, Play, Search, Sparkles, BarChart3, X, Square, Languages, Brain, AlertTriangle } from 'lucide-react';
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
    translating_stuck: 0,
    fetched_pending: 0,
    awaiting_analysis: 0,
    analysis_stuck: 0,
    awaiting_scoring: 0,
    scoring_stuck: 0,
    active_operations: 0,
    is_busy: false,
    queues: { translate: q, ingest: q, scoring: q },
  };
}

/** Hide ops stuck in running/pending longer than 30 minutes. */
function isFreshOp(op: OperationLog): boolean {
  const raw = op.started_at || op.created_at;
  if (!raw) return true;
  const ts = new Date(raw).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts < 30 * 60 * 1000;
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
      const active = opsResult.data
        .filter((op) => op.status === 'running' || op.status === 'pending')
        .filter(isFreshOp);
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

  // Live = actual BullMQ waiting+active (API already maps these into translating/awaiting_*)
  type Chip = {
    key: string;
    label: string;
    count: number;
    icon: React.ElementType;
    color: string;
    stuck?: boolean;
  };
  const liveChips: Chip[] = [];
  const stuckChips: Chip[] = [];

  if (pipeline.translating > 0) {
    liveChips.push({
      key: 'translate',
      label: 'Перевод',
      count: pipeline.translating,
      icon: Languages,
      color: 'text-cyan-600',
    });
  } else if (pipeline.translating_stuck > 0) {
    stuckChips.push({
      key: 'translate-stuck',
      label: 'Перевод',
      count: pipeline.translating_stuck,
      icon: AlertTriangle,
      color: 'text-amber-600',
      stuck: true,
    });
  }

  if (pipeline.awaiting_analysis > 0) {
    liveChips.push({
      key: 'analysis',
      label: 'Саммари',
      count: pipeline.awaiting_analysis,
      icon: Brain,
      color: 'text-violet-600',
    });
  } else if (pipeline.analysis_stuck > 0) {
    stuckChips.push({
      key: 'analysis-stuck',
      label: 'Саммари',
      count: pipeline.analysis_stuck,
      icon: AlertTriangle,
      color: 'text-amber-600',
      stuck: true,
    });
  }

  if (pipeline.awaiting_scoring > 0) {
    liveChips.push({
      key: 'score',
      label: 'Скоринг',
      count: pipeline.awaiting_scoring,
      icon: BarChart3,
      color: 'text-amber-500',
    });
  } else if (pipeline.scoring_stuck > 0) {
    stuckChips.push({
      key: 'score-stuck',
      label: 'Скоринг',
      count: pipeline.scoring_stuck,
      icon: AlertTriangle,
      color: 'text-amber-600',
      stuck: true,
    });
  }

  const hasLive = activeOps.length > 0 || liveChips.length > 0;
  const hasStuckOnly = !hasLive && stuckChips.length > 0;
  if (!hasLive && !hasStuckOnly) return null;

  const summaryMap = new Map<string, string>();
  for (const operation of activeOps) {
    const info = getOperationInfo(operation.operation_type);
    summaryMap.set(info.label, 'live');
  }
  for (const chip of liveChips) {
    summaryMap.set(chip.label, 'live');
  }
  // stuck only shown if no live of same label
  for (const chip of stuckChips) {
    if (!summaryMap.has(chip.label)) summaryMap.set(chip.label, 'stuck');
  }

  const summaryItems = Array.from(summaryMap.entries());

  return (
    <div className="fixed bottom-[68px] left-0 right-0 z-30 md:bottom-0 md:left-64">
      <div
        className={cn(
          'mx-2 mb-2 rounded-2xl border bg-white/92 shadow-[0_12px_40px_rgba(15,51,122,0.12)] backdrop-blur-2xl transition-all md:mx-4',
          hasLive ? 'border-cyan-200/70' : 'border-amber-200/80',
          expanded ? 'p-3.5' : 'px-3.5 py-2.5'
        )}
      >
        <div className="flex cursor-pointer items-center gap-3" onClick={() => setExpanded(!expanded)}>
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-md',
              hasLive
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-200/70'
                : 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-200/70'
            )}
          >
            {hasLive ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {summaryItems.map(([label, kind]) => (
              <span
                key={label}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
                  kind === 'live'
                    ? 'bg-slate-50 text-slate-700 ring-slate-100'
                    : 'bg-amber-50 text-amber-800 ring-amber-100'
                )}
              >
                {label}
              </span>
            ))}
            <span className="text-xs font-medium text-muted-foreground">
              — {hasLive ? 'выполняется' : 'очередь зависла (worker догонит)'}
            </span>
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
            {[...liveChips, ...stuckChips].map((chip) => {
              const Icon = chip.icon;
              return (
                <div key={chip.key} className="flex items-center gap-2 text-xs">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', chip.color)} />
                  <span className="truncate font-medium">{chip.label}</span>
                  <span className="flex-1 truncate text-muted-foreground">
                    {chip.stuck
                      ? `${chip.count} статей ждут повторной постановки в очередь`
                      : `${chip.count} jobs в очереди worker`}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      chip.stuck ? 'bg-amber-50 text-amber-700' : 'bg-cyan-50 text-cyan-700'
                    )}
                  >
                    {chip.stuck ? 'Зависло' : 'В работе'}
                  </span>
                </div>
              );
            })}
            {activeOps.map((operation) => {
              const info = getOperationInfo(operation.operation_type);
              const Icon = info.icon;
              return (
                <div key={operation.id} className="flex items-center gap-2 text-xs">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', info.color)} />
                  <span className="truncate font-medium">{info.label}</span>
                  <span className="flex-1 truncate text-muted-foreground">{operation.message || 'выполняется'}</span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleCancel(operation.id);
                    }}
                    disabled={cancellingId === operation.id}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Остановить"
                  >
                    {cancellingId === operation.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
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
