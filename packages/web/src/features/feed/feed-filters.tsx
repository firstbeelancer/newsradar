import { Button } from '@shared/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select';
import type { Agent, Source } from '@shared/api/client';
import { Bookmark } from 'lucide-react';
import { cn } from '@shared/lib/utils';

export interface FeedFiltersState {
  agentId: string;
  sourceId: string;
  status: string;
  favoritesOnly: boolean;
}

interface FeedFiltersProps {
  agents: Agent[];
  sources: Source[];
  filters: FeedFiltersState;
  onChange: (filters: FeedFiltersState | ((prev: FeedFiltersState) => FeedFiltersState)) => void;
}

const ALL_AGENTS_VALUE = '__all_agents__';
const ALL_SOURCES_VALUE = '__all_sources__';
const ALL_STATUSES_VALUE = '__all_statuses__';

export function FeedFilters({ agents, sources, filters, onChange }: FeedFiltersProps) {
  const agentScopedSources = filters.agentId ? sources.filter((source) => source.agent_id === filters.agentId) : sources;
  const visibleSources = filters.agentId && agentScopedSources.length > 0 ? agentScopedSources : sources;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.agentId || ALL_AGENTS_VALUE}
          onValueChange={(value) => {
            onChange((prev) => ({ ...prev, agentId: value === ALL_AGENTS_VALUE ? '' : value, sourceId: '' }));
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
          value={filters.sourceId || ALL_SOURCES_VALUE}
          onValueChange={(value) => {
            onChange((prev) => ({ ...prev, sourceId: value === ALL_SOURCES_VALUE ? '' : value }));
          }}
        >
          <SelectTrigger className="w-[190px] h-8 text-xs">
            <SelectValue placeholder="Все источники" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SOURCES_VALUE}>Все источники</SelectItem>
            {visibleSources.map((source) => (
              <SelectItem key={source.id} value={source.id}>
                {source.name}
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

    </div>
  );
}
