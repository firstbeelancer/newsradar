import { useState, useEffect } from 'react';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Textarea } from '@shared/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Skeleton } from '@shared/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select';
import { useSettingsStore } from '@shared/stores/settings-store';
import { useToast } from '@shared/ui/toast';
import { Plus, FileText, Pencil, Trash2 } from 'lucide-react';
import type { Template, CreateTemplateDto } from '@shared/api/client';

export function TemplatesSettings() {
  const { addToast } = useToast();
  const {
    templates,
    isTemplatesLoading,
    isTemplateSubmitting,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useSettingsStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<'post' | 'digest'>('post');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const resetForm = () => {
    setName('');
    setType('post');
    setSystemPrompt('');
    setUserPrompt('');
    setEditingTemplate(null);
  };

  const openNew = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (template: Template) => {
    setEditingTemplate(template);
    setName(template.name);
    setType(template.type);
    setSystemPrompt(template.system_prompt);
    setUserPrompt(template.user_prompt);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !systemPrompt.trim() || !userPrompt.trim()) {
      addToast({ title: 'Ошибка', description: 'Заполните все обязательные поля', variant: 'danger' });
      return;
    }

    const data: CreateTemplateDto = {
      name: name.trim(),
      type,
      system_prompt: systemPrompt.trim(),
      user_prompt: userPrompt.trim(),
    };

    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, data);
        addToast({ title: 'Сохранено', description: 'Шаблон обновлен', variant: 'success' });
      } else {
        await createTemplate(data);
        addToast({ title: 'Создано', description: 'Шаблон создан', variant: 'success' });
      }
      setFormOpen(false);
      resetForm();
    } catch {
      // Error handled by store
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;
    try {
      await deleteTemplate(deletingTemplate.id);
      addToast({ title: 'Удалено', description: 'Шаблон удален', variant: 'success' });
      setDeleteDialogOpen(false);
    } catch {
      // Error handled by store
    }
  };

  if (isTemplatesLoading && templates.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Шаблоны</h2>
          <p className="text-sm text-muted-foreground">{templates.length} шаблонов</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" />
          Новый шаблон
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <FileText className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Нет шаблонов</p>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Создать шаблон
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <Card key={template.id} className="group hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{template.name}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {template.type === 'post' ? 'Пост' : 'Дайджест'}
                      </Badge>
                      {template.is_default && (
                        <Badge variant="primary" className="text-[10px]">По умолчанию</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {template.user_prompt}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="outline" size="icon-sm" onClick={() => openEdit(template)} title="Редактировать">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => { setDeletingTemplate(template); setDeleteDialogOpen(true); }}
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Редактировать шаблон' : 'Новый шаблон'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              label="Название"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Краткий пост"
              required
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Тип</label>
              <Select value={type} onValueChange={(v) => setType(v as 'post' | 'digest')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Пост</SelectItem>
                  <SelectItem value="digest">Дайджест</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Textarea
              label="System prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Системная инструкция для AI..."
              rows={4}
              required
            />

            <Textarea
              label="User prompt"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Шаблон запроса с переменными..."
              rows={6}
              required
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} loading={isTemplateSubmitting}>
              {editingTemplate ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить шаблон</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Вы уверены, что хотите удалить шаблон &quot;{deletingTemplate?.name}&quot;?
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
