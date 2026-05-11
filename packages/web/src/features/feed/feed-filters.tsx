import { Button } from '@shared/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select';
import type { Agent } from '@shared/api/client';
import { Bookmark } from 'lucide-react';
import { cn } from '@shared/lib/utils';

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

const CHIP_OPTIONS = [
  { key: 'exclusive', label: 'Эксклюзив' },
  { key: 'actionable', label: 'Actionable' },
  { key: 'trending', label: 'Трендинг' },
  { key: 'controversy', label: 'Контроверсия' },
  { key: 'verified', label: 'Проверено' },
] as const;

export function FeedFilters({ agents, filters, onChange }: FeedFiltersProps) {
  const toggleChip = (chip: string) => {
    onChange((prev) => ({
      ...prev,
      chips: prev.chips.includes(chip)
        ? prev.chips.filter((c) => c !== chip)
        : [...prev.chips, chip],
    }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={filters.agentId || ALL_AGENTS_VALUE}
        onValueChange={(value) => {
          onChange((prev) => ({ ...prev, agentId: value === ALL_AGENTS_VALUE ? '' : value }));
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

      {/* Chip filter buttons */}
      {CHIP_OPTIONS.map((chip) => {
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
