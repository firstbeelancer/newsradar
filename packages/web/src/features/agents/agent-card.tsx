import { Link, useNavigate } from '@tanstack/react-router';
import { Card, CardContent } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu';
import {
  Bot, MoreVertical, Pencil, Trash2, Play, CircleDot, Link2,
  Shield, Brain, Megaphone, Heart, Paintbrush, Globe, Zap, Star,
  Eye, Search, BookOpen, Rss, MessageCircle, Target, Lightbulb,
  Compass, Newspaper, Hammer, Wrench, type LucideIcon,
} from 'lucide-react';
import { cn } from '@shared/lib/utils';
import type { Agent } from '@shared/api/client';

interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onCollect: (agent: Agent) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  bot: Bot,
  shield: Shield,
  brain: Brain,
  megaphone: Megaphone,
  heart: Heart,
  paintbrush: Paintbrush,
  globe: Globe,
  zap: Zap,
  star: Star,
  eye: Eye,
  search: Search,
  book: BookOpen,
  bookopen: BookOpen,
  rss: Rss,
  message: MessageCircle,
  messagecircle: MessageCircle,
  target: Target,
  lightbulb: Lightbulb,
  compass: Compass,
  newspaper: Newspaper,
  hammer: Hammer,
  wrench: Wrench,
};

function getAgentIcon(iconStr?: string): LucideIcon {
  if (!iconStr) return Bot;
  const key = iconStr.toLowerCase().replace(/[^a-z]/g, '');
  return ICON_MAP[key] || Bot;
}

export function AgentCard({ agent, onEdit, onDelete, onCollect }: AgentCardProps) {
  const navigate = useNavigate();
  const AgentIcon = getAgentIcon(agent.icon);
  const agentColor = agent.color || '#0ea5e9';
  const isHex = agentColor.startsWith('#');

  return (
    <Card className="group transition-all hover:shadow-md overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link
            to="/agents/$id"
            params={{ id: agent.id }}
            className={cn(
              'flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105'
            )}
            style={isHex ? { backgroundColor: `${agentColor}18`, color: agentColor } : undefined}
          >
            <AgentIcon className="h-5 w-5" />
          </Link>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap">
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

            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <CircleDot className="h-3 w-3" />
                {agent.article_count ?? 0} новостей
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  navigate({ to: '/agents/$id', params: { id: agent.id } });
                }}
                className="flex items-center gap-1 hover:text-accent transition-colors cursor-pointer"
              >
                <Link2 className="h-3 w-3" />
                {agent.source_count ?? 0} источников
              </button>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
