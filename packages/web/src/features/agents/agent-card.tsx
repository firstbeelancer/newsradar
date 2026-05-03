import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu';
import { Bot, MoreVertical, Pencil, Trash2, Play, CircleDot } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import type { Agent } from '@shared/api/client';

interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onCollect: (agent: Agent) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  bot: <Bot className="h-5 w-5" />,
  default: <Bot className="h-5 w-5" />,
};

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
  default: 'bg-accent-light text-accent',
};

export function AgentCard({ agent, onEdit, onDelete, onCollect }: AgentCardProps) {
  const icon = iconMap[agent.icon] || iconMap.default;
  const colorClass = colorMap[agent.color] || colorMap.default;

  return (
    <Card className="group transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link
            to="/agents/$id"
            params={{ id: agent.id }}
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
              colorClass
            )}
          >
            {icon}
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                to="/agents/$id"
                params={{ id: agent.id }}
                className="truncate text-sm font-semibold hover:text-accent transition-colors"
              >
                {agent.name}
              </Link>
              <Badge
                variant={agent.is_active ? 'success' : 'default'}
                className="shrink-0 text-[10px]"
              >
                {agent.is_active ? 'Активен' : 'Пауза'}
              </Badge>
            </div>

            {agent.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {agent.description}
              </p>
            )}

            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CircleDot className="h-3 w-3" />
                {agent.article_count ?? 0} новостей
              </span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onCollect(agent)}>
                <Play className="mr-2 h-4 w-4" />
                Собрать новости
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(agent)}>
                <Pencil className="mr-2 h-4 w-4" />
                Редактировать
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(agent)}
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
