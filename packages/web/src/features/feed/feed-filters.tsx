import { Button } from '@shared/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select';
import type { Agent } from '@shared/api/client';
import { Filter, Bookmark } from 'lucide-react';
import { cn } from '@shared/lib/utils';

export interface FeedFiltersState {
  agentId: string;
  status: string;
  favoritesOnly: boolean;
}

interface FeedFiltersProps {
  agents: Agent[];
  filters: FeedFiltersState;
  onChange: (filters: Partial<FeedFiltersState>) => void;
}

export function FeedFilters({ agents, filters, onChange }: FeedFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={filters.agentId}
        onValueChange={(v) => onChange({ agentId: v })}
      >
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Все агенты" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Все агенты</SelectItem>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(v) => onChange({ status: v })}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Все статусы</SelectItem>
          <SelectItem value="new">Новые</SelectItem>
          <SelectItem value="read">Прочитанные</SelectItem>
          <SelectItem value="archived">Архив</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant={filters.favoritesOnly ? 'warning' : 'outline'}
        size="sm"
        className={cn('h-8 text-xs gap-1.5', filters.favoritesOnly && 'text-warning-foreground')}
        onClick={() => onChange({ favoritesOnly: !filters.favoritesOnly })}
      >
        <Bookmark className={cn('h-3.5 w-3.5', filters.favoritesOnly && 'fill-current')} />
        Избранное
      </Button>
    </div>
  );
}
