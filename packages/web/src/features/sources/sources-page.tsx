import { useState, useEffect } from 'react';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { Skeleton } from '@shared/ui/skeleton';
import { Input } from '@shared/ui/input';
import { useSourcesStore } from '@shared/stores/sources-store';
import { useAgentsStore } from '@shared/stores/agents-store';
import { useToast } from '@shared/ui/toast';
import { SourceCard } from './source-card';
import { SourceForm } from './source-form';
import { SourceTestButton } from './source-test-button';
import { matchesSourceSearch } from './source-search';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/ui/dialog';
import { Plus, Link2, Search } from 'lucide-react';
import { sourcesApi, type Source, type CreateSourceDto, type UpdateSourceDto } from '@shared/api/client';

export function SourcesPage() {
  const { addToast } = useToast();
  const {
    sources,
    isLoading,
    isSubmitting,
    error,
    fetchSources,
    createSource,
    updateSource,
    deleteSource,
    clearTestResult,
  } = useSourcesStore();

  const { agents, fetchAgents } = useAgentsStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testingSource, setTestingSource] = useState<Source | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSource, setDeletingSource] = useState<Source | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSources();
    fetchAgents();
  }, [fetchSources, fetchAgents]);

  useEffect(() => {
    if (error) {
      addToast({ title: 'Ошибка', description: error, variant: 'danger' });
    }
  }, [error, addToast]);

  const filteredSources = sources.filter((source) => matchesSourceSearch(source, search));

  const handleEdit = (source: Source) => {
    setEditingSource(source);
    setFormOpen(true);
  };

  const handleDeleteClick = (source: Source) => {
    setDeletingSource(source);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSource) return;
    setIsDeleting(true);
    try {
      await deleteSource(deletingSource.id);
      addToast({ title: 'Удалено', description: `Источник "${deletingSource.name}" удален`, variant: 'success' });
      setDeleteDialogOpen(false);
    } catch {
      // Error handled by store
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTest = (source: Source) => {
    setTestingSource(source);
    clearTestResult();
    setTestDialogOpen(true);
  };

  const handleToggleActive = async (source: Source) => {
    try {
      await updateSource(source.id, { isActive: !source.is_active } as UpdateSourceDto);
      addToast({ 
        title: source.is_active ? 'Отключен' : 'Включен', 
        description: `Источник "${source.name}" ${source.is_active ? 'отключен' : 'включен'}`, 
        variant: 'success' 
      });
    } catch {
      addToast({ title: 'Ошибка', description: 'Не удалось изменить статус источника', variant: 'danger' });
    }
  };

  const handleFetch = async (source: Source) => {
    try {
      await sourcesApi.fetch(source.id);
      addToast({ title: 'Сбор запущен', description: `Источник "${source.name}"`, variant: 'success' });
    } catch (err) {
      addToast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось запустить сбор',
        variant: 'danger',
      });
    }
  };

  const handleSubmit = async (data: CreateSourceDto | UpdateSourceDto) => {
    try {
      if (editingSource) {
        await updateSource(editingSource.id, data as UpdateSourceDto);
        addToast({ title: 'Сохранено', description: 'Источник обновлен', variant: 'success' });
      } else {
        await createSource(data as CreateSourceDto);
        addToast({ title: 'Создано', description: 'Источник добавлен', variant: 'success' });
      }
    } catch {
      // Error handled by store
    }
  };

  if (isLoading && sources.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="nr-page-title">Источники</h1>
          <p className="text-muted-foreground mt-1">
            {search.trim() ? `Найдено ${filteredSources.length} из ${sources.length}` : `${sources.length} источников`}
          </p>
        </div>
        <Button onClick={() => { setEditingSource(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Новый источник</span>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию или URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Empty state */}
      {sources.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light text-accent mb-4">
              <Link2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold">Нет источников</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6 text-center max-w-sm">
              Добавьте первый источник для сбора новостей
            </p>
            <Button onClick={() => { setEditingSource(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              Добавить источник
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Sources list */
        <div className="space-y-3">
          {filteredSources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              assignedAgents={source.agents.length > 0
                ? source.agents
                : agents
                    .filter((agent) => agent.id === source.agent_id)
                    .map((agent) => ({ id: agent.id, name: agent.name, color: agent.color, icon: agent.icon }))}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onTest={handleTest}
              onFetch={handleFetch}
              onToggleActive={handleToggleActive}
            />
          ))}
          {filteredSources.length === 0 && search && (
            <p className="text-center text-sm text-muted-foreground py-8">
              По запросу &quot;{search}&quot; ничего не найдено
            </p>
          )}
        </div>
      )}

      {/* Form Dialog */}
      <SourceForm
        source={editingSource}
        agents={agents}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingSource(null);
        }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      {/* Test Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Тест источника: {testingSource?.name}</DialogTitle>
          </DialogHeader>
          {testingSource && (
            <SourceTestButton sourceId={testingSource.id} />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить источник</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Вы уверены, что хотите удалить источник &quot;{deletingSource?.name}&quot;? Это действие нельзя отменить.
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
