import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { Skeleton } from '@shared/ui/skeleton';
import { Switch } from '@shared/ui/switch';
import { useAgentsStore } from '@shared/stores/agents-store';
import { useToast } from '@shared/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/ui/dialog';
import {
  Bot, Plus, Pencil, Trash2, ArrowRight,
  Shield, Brain, Megaphone, Heart, Paintbrush, Globe, Zap, Star,
  Eye, Search, BookOpen, Rss, MessageCircle, Target, Lightbulb,
  Compass, Newspaper, Hammer, Wrench, type LucideIcon,
} from 'lucide-react';
import { cn } from '@shared/lib/utils';
import type { Agent, CreateAgentDto, UpdateAgentDto } from '@shared/api/client';
import { AgentForm } from '@/features/agents/agent-form';
import { buildSettingsAgentCreatePayload } from '@/features/agents/agent-tags';

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

export function AgentsSettings() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const {
    agents,
    isLoading,
    isSubmitting,
    fetchAgents,
    updateAgent,
    deleteAgent,
    createAgent,
  } = useAgentsStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleToggleActive = async (agent: Agent) => {
    try {
      await updateAgent(agent.id, { is_active: !agent.is_active });
      addToast({
        title: 'Обновлено',
        description: `Агент "${agent.name}" ${!agent.is_active ? 'активирован' : 'отключен'}`,
        variant: 'success',
      });
    } catch {
      // Error handled by store
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingAgent) return;
    try {
      await deleteAgent(deletingAgent.id);
      addToast({ title: 'Удалено', description: `Агент "${deletingAgent.name}" удален`, variant: 'success' });
      setDeleteDialogOpen(false);
    } catch {
      // Error handled by store
    }
  };

  const handleSubmit = async (data: CreateAgentDto | UpdateAgentDto) => {
    try {
      if (editingAgent) {
        await updateAgent(editingAgent.id, data);
        addToast({ title: 'Сохранено', description: 'Агент обновлен', variant: 'success' });
      } else {
        await createAgent(buildSettingsAgentCreatePayload(data, agents.length));
        addToast({ title: 'Создано', description: 'Агент создан', variant: 'success' });
      }
      setFormOpen(false);
    } catch {
      // Error handled by store
    }
  };

  if (isLoading && agents.length === 0) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Агенты</h2>
          <p className="text-sm text-muted-foreground">Управление агентами сбора</p>
        </div>
        <Button size="sm" onClick={() => { setEditingAgent(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" />
          Новый агент
        </Button>
      </div>

      <div className="space-y-2">
        {agents.map((agent) => {
          const AgentIcon = getAgentIcon(agent.icon);
          const agentColor = agent.color || '#3b82f6';
          const isHex = agentColor.startsWith('#');
          return (
          <Card key={agent.id} className="hover:shadow-md transition-all overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={isHex ? { backgroundColor: `${agentColor}18`, color: agentColor } : undefined}
                >
                  <AgentIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{agent.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {agent.description || 'Нет описания'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                <Switch
                  checked={agent.is_active}
                  onCheckedChange={() => handleToggleActive(agent)}
                />
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(agent)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => { setDeletingAgent(agent); setDeleteDialogOpen(true); }}
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => navigate({ to: '/agents/$id', params: { id: agent.id } })}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      <AgentForm
        agent={editingAgent}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить агента</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Вы уверены, что хотите удалить агента &quot;{deletingAgent?.name}&quot;?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
