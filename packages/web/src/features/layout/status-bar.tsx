import { useState, useEffect, useCallback } from 'react';
import { cn } from '@shared/lib/utils';
import { apiGet } from '@shared/api/client';
import { Loader2, Zap, Newspaper, BarChart3, Languages, Sparkles, Search } from 'lucide-react';

interface OperationLog {
  id: string;
  operationType: string;
  status: string;
  message: string | null;
  agentId: string | null;
  metadata: Record<string, unknown> | null;
  startedAt: string;
}

interface StatusBarState {
  operations: OperationLog[];
  isLoading: boolean;
}

const OPERATION_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  collect_agent: { label: 'Сбор', icon: Newspaper },
  fetch_source: { label: 'Сбор', icon: Newspaper },
  score_article: { label: 'Скоринг', icon: BarChart3 },
  translate_article: { label: 'Перевод', icon: Languages },
  generate_post: { label: 'Генерация', icon: Sparkles },
  generate_digest: { label: 'Дайджест', icon: Sparkles },
  deepsearch: { label: 'Deep Search', icon: Search },
};

function getOperationInfo(type: string) {
  return OPERATION_LABELS[type] ?? { label: type, icon: Zap };
}

export function StatusBar() {
  const [state, setState] = useState<StatusBarState>({
    operations: [],
    isLoading: false,
  });

  const fetchRunningOperations = useCallback(async () => {
    try {
      const result = await apiGet<{ data: OperationLog[] }>('/operation-logs?status=running&limit=5');
      const operations = result?.data ?? (Array.isArray(result) ? result : []);
      setState({ operations, isLoading: false });
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    fetchRunningOperations();
    const interval = setInterval(fetchRunningOperations, 5000);
    return () => clearInterval(interval);
  }, [fetchRunningOperations]);

  const runningOps = state.operations.filter((op) => op.status === 'running');

  if (runningOps.length === 0) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 md:ml-64">
        <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm px-4 py-1.5 flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-success" />
            <span>Система готова</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:ml-64">
      <div className="border-t border-accent/20 bg-accent-light/30 backdrop-blur-sm px-4 py-1.5">
        <div className="flex items-center gap-4 overflow-x-auto">
          {runningOps.map((op) => {
            const info = getOperationInfo(op.operationType);
            const Icon = info.icon;
            return (
              <div
                key={op.id}
                className="flex items-center gap-2 text-xs whitespace-nowrap"
              >
                <Loader2 className="h-3 w-3 animate-spin text-accent" />
                <Icon className="h-3 w-3 text-accent" />
                <span className="font-medium text-accent">{info.label}</span>
                {op.message && (
                  <span className="text-muted-foreground truncate max-w-[200px]">
                    {op.message}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
