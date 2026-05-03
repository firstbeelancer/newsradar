import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { Skeleton } from '@shared/ui/skeleton';
import { Spinner } from '@shared/ui/spinner';
import { useAgentsStore } from '@shared/stores/agents-store';
import { useToast } from '@shared/ui/toast';
import { AgentCard } from './agent-card';
import { AgentForm } from './agent-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/ui/dialog';
import { Plus, Bot, ArrowUpDown } from 'lucide-react';
import type { Agent, CreateAgentDto, UpdateAgentDto } from '@shared/api/client';

export function AgentsListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const {
    agents,
    isLoading,
    isSubmitting,
    error,
    fetchAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    collectAgent,
  } = useAgentsStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (error) {
      addToast({ title: 'Ошибка', description: error, variant: 'danger' });
    }
  }, [error, addToast]);

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormOpen(true);
  };

  const handleDeleteClick = (agent: Agent) => {
    setDeletingAgent(agent);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAgent) return;
    setIsDeleting(true);
    try {
      await deleteAgent(deletingAgent.id);
      addToast({ title: 'Удалено', description: `Агент "${deletingAgent.name}" удален`, variant: 'success' });
      setDeleteDialogOpen(false);
    } catch {
      // Error handled by store
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (data: CreateAgentDto | UpdateAgentDto) => {
    try {
      if (editingAgent) {
        await updateAgent(editingAgent.id, data as UpdateAgentDto);
        addToast({ title: 'Сохранено', description: 'Агент обновлен', variant: 'success' });
      } else {
        await createAgent(data as CreateAgentDto);
        addToast({ title: 'Создано', description: 'Агент создан', variant: 'success' });
      }
    } catch {
      // Error handled by store
    }
  };

  const handleCollect = async (agent: Agent) => {
    try {
      await collectAgent(agent.id);
      addToast({ title: 'Сбор запущен', description: `Агент "${agent.name}" собирает новости`, variant: 'success' });
    } catch {
      // Error handled by store
    }
  };

  const handleNewAgent = () => {
    setEditingAgent(null);
    setFormOpen(true);
  };

  if (isLoading && agents.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Агенты</h1>
          <p className="text-muted-foreground mt-1">
            {agents.length} {agents.length === 1 ? 'агент' : agents.length < 5 ? 'агента' : 'агентов'}
          </p>
        </div>
        <Button onClick={handleNewAgent}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Новый агент</span>
        </Button>
      </div>

      {/* Empty state */}
      {agents.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light text-accent mb-4">
              <Bot className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold">Нет агентов</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6 text-center max-w-sm">
              Создайте первого агента для начала сбора новостей
            </p>
            <Button onClick={handleNewAgent}>
              <Plus className="h-4 w-4" />
              Создать агента
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Agents grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onCollect={handleCollect}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <AgentForm
        agent={editingAgent}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить агента</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Вы уверены, что хотите удалить агента &quot;{deletingAgent?.name}&quot;? Это действие нельзя отменить.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Отмена
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete} loading={isDeleting}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
