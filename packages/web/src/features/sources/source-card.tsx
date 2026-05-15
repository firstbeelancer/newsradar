import { Card, CardContent } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu';
import { Rss, Send, MoreVertical, Pencil, Trash2, TestTube, Download } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import type { Source } from '@shared/api/client';

interface SourceCardProps {
  source: Source;
  onEdit: (source: Source) => void;
  onDelete: (source: Source) => void;
  onTest: (source: Source) => void;
  onFetch: (source: Source) => void;
  onToggleActive: (source: Source) => void;
}

const typeConfig = {
  rss: { icon: Rss, label: 'RSS', className: 'bg-orange-50 text-orange-600' },
  telegram: { icon: Send, label: 'Telegram', className: 'bg-blue-50 text-blue-600' },
};

export function SourceCard({ source, onEdit, onDelete, onTest, onFetch, onToggleActive }: SourceCardProps) {
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

            {source.last_error && (
              <p className="mt-1 text-xs text-danger">{source.last_error}</p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
          <Button
            variant={source.is_active ? 'outline' : 'default'}
            size="sm"
            onClick={() => onToggleActive(source)}
            className={cn(
              'h-7 text-xs gap-1.5',
              !source.is_active && 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-sm'
            )}
          >
            <div className={cn(
              'h-2 w-2 rounded-full',
              source.is_active ? 'bg-green-500' : 'bg-white/80'
            )} />
            {source.is_active ? 'Выключить' : 'Включить'}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onTest(source)}>
                <TestTube className="mr-2 h-4 w-4" />
                Тест
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFetch(source)}>
                <Download className="mr-2 h-4 w-4" />
                Собрать
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(source)}>
                <Pencil className="mr-2 h-4 w-4" />
                Редактировать
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(source)}
                className="text-danger focus:text-danger"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
