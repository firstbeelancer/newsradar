import { Button } from '@shared/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select';
import type { Agent, ChipFilter } from '@shared/api/client';
import { Bookmark, Filter } from 'lucide-react';
import { cn } from '@shared/lib/utils';

export interface FeedFiltersState {
  agentId: string;
  status: string;
  favoritesOnly: boolean;
  activeChipFilters: string[];
}

interface FeedFiltersProps {
  agents: Agent[];
  filters: FeedFiltersState;
  onChange: (filters: FeedFiltersState | ((prev: FeedFiltersState) => FeedFiltersState)) => void;
}

const ALL_AGENTS_VALUE = '__all_agents__';
const ALL_STATUSES_VALUE = '__all_statuses__';

export function FeedFilters({ agents, filters, onChange }: FeedFiltersProps) {
  const selectedAgent = agents.find((a) => a.id === filters.agentId);
  const agentChipFilters = selectedAgent?.chipFilters ?? [];
  const configChipFilters = (selectedAgent?.config?.chipFilters ?? []) as Partial<ChipFilter>[];
  const allChipFilters: Partial<ChipFilter>[] = agentChipFilters.length > 0 ? agentChipFilters : configChipFilters;

  const toggleChipFilter = (key: string) => {
    onChange((prev) => ({
      ...prev,
      activeChipFilters: prev.activeChipFilters.includes(key)
        ? prev.activeChipFilters.filter((k) => k !== key)
        : [...prev.activeChipFilters, key],
    }));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.agentId || ALL_AGENTS_VALUE}
          onValueChange={(value) => {
            onChange((prev) => ({ ...prev, agentId: value === ALL_AGENTS_VALUE ? '' : value, activeChipFilters: [] }));
          }}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Все агенты" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_AGENTS_VALUE}>Все агенты</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status || ALL_STATUSES_VALUE}
          onValueChange={(value) => {
            onChange((prev) => ({ ...prev, status: value === ALL_STATUSES_VALUE ? '' : value }));
          }}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES_VALUE}>Все статусы</SelectItem>
            <SelectItem value="new">Новые</SelectItem>
            <SelectItem value="read">Прочитанные</SelectItem>
            <SelectItem value="archived">Архив</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 text-xs gap-1.5',
            filters.favoritesOnly && 'border-warning bg-warning-light text-warning hover:bg-warning-light/80'
          )}
          onClick={() => onChange((prev) => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))}
        >
          <Bookmark className={cn('h-3.5 w-3.5', filters.favoritesOnly && 'fill-current')} />
          Избранное
        </Button>
      </div>

      {/* Chip Filters */}
      {allChipFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
          {allChipFilters.filter(cf => cf.isActive !== false).map((cf) => {
            const key = cf.key ?? '';
            const isActive = filters.activeChipFilters.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleChipFilter(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all border',
                  isActive
                    ? 'border-accent bg-accent-light text-accent shadow-sm'
                    : 'border-border bg-white/60 text-muted-foreground hover:bg-white hover:text-foreground hover:border-cyan-200/60'
                )}
              >
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: isActive ? ((cf as ChipFilter).color || '#0064f4') : '#94a3b8' }}
                />
                {cf.label ?? key}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
