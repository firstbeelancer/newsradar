import { useState, useEffect } from 'react';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog';
import { Label } from '@shared/ui/label';
import type { Agent, CreateAgentDto, UpdateAgentDto } from '@shared/api/client';
import { Bot, FlaskConical, TrendingUp, Palette } from 'lucide-react';
import { cn } from '@shared/lib/utils';

const ICONS = [
  { value: 'bot', label: 'Бот', icon: Bot },
  { value: 'flask', label: 'Наука', icon: FlaskConical },
  { value: 'trending', label: 'Тренды', icon: TrendingUp },
  { value: 'palette', label: 'Творчество', icon: Palette },
];

const COLORS = [
  { value: 'blue', class: 'bg-blue-500' },
  { value: 'green', class: 'bg-green-500' },
  { value: 'purple', class: 'bg-purple-500' },
  { value: 'orange', class: 'bg-orange-500' },
  { value: 'red', class: 'bg-red-500' },
  { value: 'default', class: 'bg-accent' },
];

interface AgentFormProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateAgentDto | UpdateAgentDto) => Promise<void>;
  isSubmitting: boolean;
}

export function AgentForm({ agent, open, onOpenChange, onSubmit, isSubmitting }: AgentFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('bot');
  const [color, setColor] = useState('blue');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description || '');
      setIcon(agent.icon);
      setColor(agent.color);
    } else {
      setName('');
      setDescription('');
      setIcon('bot');
      setColor('blue');
    }
    setErrors({});
  }, [agent, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Название обязательно';
    if (name.length > 100) newErrors.name = 'Максимум 100 символов';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data: CreateAgentDto = {
      name: name.trim(),
      description: description.trim(),
      icon,
      color,
      is_active: true,
    };

    await onSubmit(agent ? { ...data, id: agent.id } : data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{agent ? 'Редактировать агента' : 'Новый агент'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            placeholder="Например: Технологии"
            required
          />

          <div className="space-y-1.5">
            <Label>Описание</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание агента..."
              rows={3}
              className={cn(
                'flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors',
                'placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0',
                'resize-none'
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Иконка</Label>
            <div className="flex gap-2">
              {ICONS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setIcon(item.value)}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all',
                      icon === item.value
                        ? 'border-accent bg-accent-light text-accent'
                        : 'border-border text-muted-foreground hover:border-muted-foreground'
                    )}
                    title={item.label}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Цвет</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    'h-8 w-8 rounded-full transition-all',
                    c.class,
                    color === c.value ? 'ring-2 ring-offset-2 ring-accent scale-110' : 'hover:scale-105'
                  )}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {agent ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
