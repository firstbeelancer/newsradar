import { useMemo, useState } from 'react';
import { Badge } from '@shared/ui/badge';
import { cn } from '@shared/lib/utils';
import type { OperationLog } from '@shared/api/client';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Loader2, Clock3 } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  success: 'Успех',
  partial: 'Частично',
  failed: 'Ошибка',
  running: 'Выполняется',
  pending: 'Ожидание',
  cancelled: 'Отменено',
  completed: 'Готово',
};

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' | 'primary' {
  if (status === 'success' || status === 'completed') return 'success';
  if (status === 'partial') return 'warning';
  if (status === 'failed') return 'danger';
  if (status === 'running') return 'primary';
  return 'default';
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'success' || status === 'completed') return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === 'partial') return <AlertTriangle className="h-4 w-4 text-warning" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-danger" />;
  if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-accent" />;
  return <Clock3 className="h-4 w-4 text-muted-foreground" />;
}

type SourceRow = {
  sourceId?: string;
  sourceName?: string;
  status?: string;
  fetched?: number;
  new?: number;
  duplicates?: number;
  error?: string;
  attempts?: number;
};

function extractSourceRows(metadata?: Record<string, unknown> | null): SourceRow[] {
  if (!metadata) return [];
  const summary = metadata.sourceSummary;
  if (Array.isArray(summary) && summary.length > 0) {
    return summary as SourceRow[];
  }
  const results = metadata.results;
  if (Array.isArray(results) && results.length > 0) {
    return results as SourceRow[];
  }
  return [];
}

function extractErrorMessage(metadata?: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  for (const key of ['error', 'errorMessage', 'error_message', 'reason', 'lastError']) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function OperationLogRow({ log }: { log: OperationLog }) {
  const [open, setOpen] = useState(false);
  const sources = useMemo(() => extractSourceRows(log.metadata), [log.metadata]);
  const errorSources = sources.filter((s) => s.status === 'error' || Boolean(s.error));
  const metaError = extractErrorMessage(log.metadata);
  const expandable =
    sources.length > 0 ||
    Boolean(metaError) ||
    log.status === 'partial' ||
    log.status === 'failed' ||
    Boolean(log.message && log.message.length > 80);

  return (
    <div
      className={cn(
        'rounded-2xl border border-cyan-100/80 bg-white/80 transition-all',
        open && 'border-cyan-200 bg-gradient-to-b from-cyan-50/70 to-white shadow-sm shadow-cyan-100/60',
        expandable && 'cursor-pointer hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md hover:shadow-cyan-100/50'
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-3.5 text-left"
        onClick={() => expandable && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!expandable}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100">
            <StatusIcon status={log.status} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{log.message || log.operation_type}</p>
            <p className="text-xs font-medium text-muted-foreground">
              {new Date(log.created_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {errorSources.length > 0 ? ` · ошибок: ${errorSources.length}` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={statusVariant(log.status)} className="shrink-0 rounded-full px-2.5">
            {STATUS_LABELS[log.status] || log.status}
          </Badge>
          {expandable &&
            (open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ))}
        </div>
      </button>

      {open && (
        <div className="space-y-2 border-t border-border/70 px-3 pb-3 pt-2">
          {metaError && (
            <div className="rounded-md border border-danger/20 bg-danger-light/60 px-2.5 py-2 text-xs text-danger">
              {metaError}
            </div>
          )}

          {log.message && log.message.length > 80 && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{log.message}</p>
          )}

          {sources.length > 0 ? (
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {sources.map((source, index) => {
                const isError = source.status === 'error' || Boolean(source.error);
                return (
                  <div
                    key={`${source.sourceId ?? 'src'}-${index}`}
                    className={cn(
                      'rounded-md border px-2.5 py-2 text-xs',
                      isError ? 'border-danger/25 bg-danger-light/40' : 'border-border/70 bg-white/70'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">
                        {source.sourceName || source.sourceId || `Источник ${index + 1}`}
                      </p>
                      <Badge variant={isError ? 'danger' : 'success'} className="shrink-0 text-[10px]">
                        {isError ? 'ошибка' : 'ok'}
                      </Badge>
                    </div>
                    {!isError && (
                      <p className="mt-1 text-muted-foreground">
                        получено: {source.fetched ?? 0}, новых: {source.new ?? 0}
                        {typeof source.duplicates === 'number' ? `, дублей: ${source.duplicates}` : ''}
                      </p>
                    )}
                    {source.error && (
                      <p className="mt-1 whitespace-pre-wrap text-danger">{source.error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            !metaError && (
              <p className="text-xs text-muted-foreground">
                Детализация по источникам недоступна для этой операции.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
