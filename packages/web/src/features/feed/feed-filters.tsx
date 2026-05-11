import { Button } from '@shared/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select';
import type { Agent, ChipFilter } from '@shared/api/client';
import { Bookmark } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { useEffect, useState } from 'react';
import { chipFiltersApi } from '@shared/api/client';

export interface FeedFiltersState {
  agentId: string;
  status: string;
  favoritesOnly: boolean;
  chips: string[];
}

interface FeedFiltersProps {
  agents: Agent[];
  filters: FeedFiltersState;
  onChange: (filters: FeedFiltersState | ((prev: FeedFiltersState) => FeedFiltersState)) => void;
}

const ALL_AGENTS_VALUE = '__all_agents__';
const ALL_STATUSES_VALUE = '__all_statuses__';

// Universal chips for general feed (no agent selected)
const UNIVERSAL_CHIPS = [
  { key: 'high_priority', label: 'Высокий приоритет' },
  { key: 'medium_priority', label: 'Средний приоритет' },
  { key: 'low_priority', label: 'Низкий приоритет' },
  { key: 'russian_context', label: 'Русский контекст' },
  { key: 'fresh_news', label: 'Свежая новость' },
] as const;

export function FeedFilters({ agents, filters, onChange }: FeedFiltersProps) {
  const [agentChips, setAgentChips] = useState<ChipFilter[]>([]);
  const [chipsLoading, setChipsLoading] = useState(false);

  // Load chip filters when agent changes
  useEffect(() => {
    if (filters.agentId) {
      setChipsLoading(true);
      chipFiltersApi.list(filters.agentId)
        .then((chips) => {
          setAgentChips(chips);
        })
        .catch(() => {
          setAgentChips([]);
        })
        .finally(() => {
          setChipsLoading(false);
        });
    } else {
      setAgentChips([]);
    }
  }, [filters.agentId]);

  const toggleChip = (chip: string) => {
    onChange((prev) => ({
      ...prev,
      chips: prev.chips.includes(chip)
        ? prev.chips.filter((c) => c !== chip)
        : [...prev.chips, chip],
    }));
  };

  // Determine which chips to show
  const displayChips = filters.agentId && agentChips.length > 0
    ? agentChips.filter(c => c.is_active).map(c => ({ key: c.key, label: c.label, color: c.color }))
    : UNIVERSAL_CHIPS.map(c => ({ key: c.key, label: c.label, color: 'default' }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={filters.agentId || ALL_AGENTS_VALUE}
        onValueChange={(value) => {
          onChange((prev) => ({ ...prev, agentId: value === ALL_AGENTS_VALUE ? '' : value, chips: [] }));
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
          <SelectItem value="scored">Оценённые</SelectItem>
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

      {/* Dynamic chip filter buttons */}
      {displayChips.map((chip) => {
        const isActive = filters.chips.includes(chip.key);
        return (
          <Button
            key={chip.key}
            variant="outline"
            size="sm"
            className={cn(
              'h-8 text-xs gap-1.5 rounded-full',
              isActive && 'border-accent bg-accent-light text-accent hover:bg-accent-light/80'
            )}
            onClick={() => toggleChip(chip.key)}
          >
            <div className={cn(
              'h-1.5 w-1.5 rounded-full transition-colors',
              isActive ? 'bg-accent' : 'bg-muted-foreground/40'
            )} />
            {chip.label}
          </Button>
        );
      })}
    </div>
  );
}
