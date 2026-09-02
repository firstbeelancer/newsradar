import { Card, CardContent } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Rss, Send, Globe, Pencil, Trash2, TestTube, Download, Bot, PauseCircle } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import type { Source, SourceAgentRef } from '@shared/api/client';

interface SourceCardProps {
  source: Source;
  assignedAgents: SourceAgentRef[];
  onEdit: (source: Source) => void;
  onDelete: (source: Source) => void;
  onTest: (source: Source) => void;
  onFetch: (source: Source) => void;
  onToggleActive: (source: Source) => void;
}

const typeConfig = {
  rss: { icon: Rss, label: 'RSS', className: 'bg-orange-50 text-orange-600' },
  telegram: { icon: Send, label: 'Telegram', className: 'bg-blue-50 text-blue-600' },
  web: { icon: Globe, label: 'Веб', className: 'bg-emerald-50 text-emerald-600' },
};

export function SourceCard({ source, assignedAgents, onEdit, onDelete, onTest, onFetch, onToggleActive }: SourceCardProps) {
  const config = typeConfig[source.type] || typeConfig.rss;
  const Icon = config.icon;

  return (
    <Card className="group transition-all hover:shadow-md overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            config.className
          )}>
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="truncate text-sm font-medium">{source.name}</p>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {config.label}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{source.url}</p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Bot className="h-3.5 w-3.5" />
                Агент:
              </span>
              {assignedAgents.length > 0 ? (
                assignedAgents.map((agent) => (
                  <Badge key={agent.id} variant="outline" className="gap-1.5 text-[10px]">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: agent.color || '#0ea5e9' }}
                    />
                    {agent.name}
                  </Badge>
                ))
              ) : (
                <Badge variant="warning" className="text-[10px]">Без агента</Badge>
              )}
            </div>

            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                {source.fetch_count} сборов
              </span>
              {source.last_fetch_at && (
                <span>
                  {new Date(source.last_fetch_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              )}
            </div>

            {source.quarantined_at ? (
              <div className="mt-2 rounded-lg border border-warning/25 bg-warning-light p-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-warning">
                  <PauseCircle className="h-3.5 w-3.5 shrink-0" />
                  Отключён автоматически после серии неудачных сборов
                </p>
                {source.last_error && (
                  <p className="mt-1 text-[11px] leading-snug text-warning/85">{source.last_error}</p>
                )}
                <p className="mt-1 text-[11px] text-warning/70">
                  Почините URL и включите обратно — счётчик ошибок сбросится.
                </p>
              </div>
            ) : (
              source.last_error && <p className="mt-1 text-xs text-danger">{source.last_error}</p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant={source.is_active ? 'outline' : 'default'}
            size="sm"
            onClick={() => onToggleActive(source)}
            className={cn(
              'h-7 text-xs gap-1.5',
              !source.is_active && 'bg-success text-white hover:bg-[#0c7350] shadow-[var(--shadow-xs)]'
            )}
          >
            <div className={cn(
              'h-2 w-2 rounded-full',
              source.is_active ? 'bg-green-500' : 'bg-white/80'
            )} />
            {source.is_active ? 'Выключить' : 'Включить'}
          </Button>

          <div className="grid grid-cols-4 gap-1 sm:flex sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onTest(source)}
              title="Проверить источник"
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <TestTube className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Тест</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onFetch(source)}
              disabled={!source.is_active || assignedAgents.length === 0}
              title={assignedAgents.length === 0 ? 'Сначала привяжи источник к агенту' : 'Собрать новости сейчас'}
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Собрать</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(source)}
              title="Редактировать источник"
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Изменить</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(source)}
              title="Удалить источник"
              className="h-7 gap-1.5 px-2 text-xs text-danger hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Удалить</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
