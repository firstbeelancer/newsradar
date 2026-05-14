import { useEffect, useState, useCallback } from 'react';
import { operationLogsApi, type OperationLog } from '@shared/api/client';
import { Loader2, Play, Search, Sparkles, BarChart3 } from 'lucide-react';
import { cn } from '@shared/lib/utils';

const OPERATION_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  collection: { label: 'Сбор', icon: Play, color: 'text-blue-500' },
  fetch_source: { label: 'Сбор', icon: Play, color: 'text-blue-500' },
  scoring: { label: 'Скоринг', icon: BarChart3, color: 'text-amber-500' },
  deepsearch: { label: 'Дипсерч', icon: Search, color: 'text-purple-500' },
  generation: { label: 'Генерация', icon: Sparkles, color: 'text-emerald-500' },
  generate_post: { label: 'Генерация', icon: Sparkles, color: 'text-emerald-500' },
  generate_digest: { label: 'Дайджест', icon: Sparkles, color: 'text-emerald-500' },
};

function getOperationInfo(type: string) {
  return OPERATION_LABELS[type] || { label: type, icon: Loader2, color: 'text-gray-500' };
}

export function StatusBar() {
  const [activeOps, setActiveOps] = useState<OperationLog[]>([]);
  const [expanded, setExpanded] = useState(false);

  const fetchActiveOps = useCallback(async () => {
    try {
      const result = await operationLogsApi.list(undefined, 10);
      const active = result.data.filter(
        (op) => op.status === 'running' || op.status === 'pending'
      );
      setActiveOps(active);
    } catch {
      // Silently ignore — status bar is non-critical
    }
  }, []);

  useEffect(() => {
    fetchActiveOps();
    const interval = setInterval(fetchActiveOps, 5000);
    return () => clearInterval(interval);
  }, [fetchActiveOps]);

  if (activeOps.length === 0) return null;

  // Compact: show summary in one line
  const summaryMap = new Map<string, number>();
  for (const op of activeOps) {
    const info = getOperationInfo(op.operation_type);
    const key = info.label;
    summaryMap.set(key, (summaryMap.get(key) || 0) + 1);
  }

  const summaryItems = Array.from(summaryMap.entries());

  return (
    <div className="fixed bottom-[68px] md:bottom-0 left-0 right-0 z-30 md:left-64">
      <div
        className={cn(
          'mx-2 md:mx-4 mb-2 rounded-xl border border-cyan-100/80 bg-white/90 shadow-lg shadow-blue-950/10 backdrop-blur-xl transition-all',
          expanded ? 'p-3' : 'px-3 py-2'
        )}
      >
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <Loader2 className="h-4 w-4 animate-spin text-cyan-600 shrink-0" />
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {summaryItems.map(([label, count]) => (
              <span key={label} className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                {label}{count > 1 ? ` ×${count}` : ''}
              </span>
            ))}
            <span className="text-xs text-muted-foreground">— выполняется</span>
          </div>
        </div>

        {expanded && (
          <div className="mt-2 space-y-1.5">
            {activeOps.map((op) => {
              const info = getOperationInfo(op.operation_type);
              const Icon = info.icon;
              return (
                <div key={op.id} className="flex items-center gap-2 text-xs">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', info.color)} />
                  <span className="font-medium truncate">{info.label}</span>
                  {op.message && (
                    <span className="text-muted-foreground truncate flex-1">{op.message}</span>
                  )}
                  <span className={cn(
                    'text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded-full',
                    op.status === 'running' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                  )}>
                    {op.status === 'running' ? 'Выполняется' : 'Ожидание'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
