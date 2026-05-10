import { useState, useEffect } from 'react';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/ui/dialog';
import { Label } from '@shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/ui/select';
import { Slider } from '@shared/ui/slider';
import type { Agent, CreateAgentDto, UpdateAgentDto } from '@shared/api/client';
import { Bot, FlaskConical, TrendingUp, Palette, Shield, Brain, HeartPulse, SlidersHorizontal } from 'lucide-react';
import { cn } from '@shared/lib/utils';

const ICONS = [
  { value: 'bot', label: 'Бот', icon: Bot },
  { value: 'flask', label: 'Наука', icon: FlaskConical },
  { value: 'trending', label: 'Тренды', icon: TrendingUp },
  { value: 'palette', label: 'Творчество', icon: Palette },
  { value: 'shield', label: 'Защита', icon: Shield },
  { value: 'brain', label: 'Мозг', icon: Brain },
  { value: 'heart', label: 'Здоровье', icon: HeartPulse },
  { value: 'sliders', label: 'Настройки', icon: SlidersHorizontal },
];

const COLORS = [
  { value: 'blue', class: 'bg-blue-500' },
  { value: 'green', class: 'bg-green-500' },
  { value: 'purple', class: 'bg-purple-500' },
  { value: 'orange', class: 'bg-orange-500' },
  { value: 'red', class: 'bg-red-500' },
  { value: 'default', class: 'bg-accent' },
];

const SUBJECT_AREAS = [
  { id: 'infosec', label: 'Информационная безопасность', icon: '🛡️' },
  { id: 'ai', label: 'Искусственный интеллект', icon: '🧠' },
  { id: 'marketing', label: 'Маркетинг', icon: '📈' },
  { id: 'medical', label: 'Медицина', icon: '🏥' },
  { id: 'design', label: 'Графический дизайн', icon: '🎨' },
  { id: 'custom', label: 'Своя тема', icon: '✏️' },
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
  const [subjectArea, setSubjectArea] = useState<string>('');
  const [customSubjectArea, setCustomSubjectArea] = useState<string>('');
  const [isCustomArea, setIsCustomArea] = useState(false);
  const [weights, setWeights] = useState({
    ai_relevance: 0.4,
    keyword_match: 0.3,
    freshness: 0.2,
    source_trust: 0.1,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description || '');
      setIcon(agent.icon);
      setColor(agent.color);
      setSubjectArea(agent.subject_area || '');
      const isCustom = !SUBJECT_AREAS.some((a) => a.id === agent.subject_area) && !!agent.subject_area;
      setIsCustomArea(isCustom);
      if (isCustom) {
        setCustomSubjectArea(agent.subject_area || '');
      }
      // Попробуем загрузить веса из agent.config, если доступно
      if (agent.subject_area) {
        const area = SUBJECT_AREAS.find((a) => a.id === agent.subject_area);
        if (area) {
          // Загружаем стоковые веса для области (по умолчанию равномерные)
          setWeights({
            ai_relevance: 0.35,
            keyword_match: 0.3,
            freshness: 0.2,
            source_trust: 0.15,
          });
        }
      }
    } else {
      setName('');
      setDescription('');
      setIcon('bot');
      setColor('blue');
      setSubjectArea('');
      setCustomSubjectArea('');
      setIsCustomArea(false);
      setWeights({
        ai_relevance: 0.35,
        keyword_match: 0.3,
        freshness: 0.2,
        source_trust: 0.15,
      });
    }
    setErrors({});
  }, [agent, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Название обязательно';
    if (name.length > 100) newErrors.name = 'Максимум 100 символов';
    if (!subjectArea && !isCustomArea) newErrors.subjectArea = 'Выберите предметную область';
    if (isCustomArea && !customSubjectArea.trim()) newErrors.subjectArea = 'Введите название предметной области';
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(totalWeight - 1) > 0.01) {
      newErrors.weights = `Сумма весов должна быть 1.0 (сейчас ${totalWeight.toFixed(2)})`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const config = {
      scoring_weights: weights,
      chip_filters: [],
      gpt_prompts: {},
      asset_pack: null,
      fetch_schedule: null,
    };

    const data: CreateAgentDto = {
      name: name.trim(),
      description: description.trim(),
      icon,
      color,
      subject_area: isCustomArea ? customSubjectArea.trim() : subjectArea,
      config,
      is_active: true,
    };

    await onSubmit(agent ? { ...data, id: agent.id } : data);
    onOpenChange(false);
  };

  const updateWeight = (key: keyof typeof weights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  const weightLabels: Record<keyof typeof weights, string> = {
    ai_relevance: 'AI-релевантность',
    keyword_match: 'Совпадение ключевых слов',
    freshness: 'Свежесть',
    source_trust: 'Достоверность источника',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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

          {/* Предметная область */}
          <div className="space-y-2">
            <Label>Предметная область</Label>
            <Select value={isCustomArea ? 'custom' : subjectArea} onValueChange={(v) => { if (v === 'custom') { setIsCustomArea(true); setSubjectArea('custom'); setCustomSubjectArea(''); } else { setIsCustomArea(false); setSubjectArea(v); setCustomSubjectArea(''); } }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите предметную область..." />
              </SelectTrigger>
              <SelectContent>
                {SUBJECT_AREAS.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    <span className="mr-2">{area.icon}</span>
                    {area.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isCustomArea && (
              <Input
                label="Название предметной области"
                value={customSubjectArea}
                onChange={(e) => setCustomSubjectArea(e.target.value)}
                placeholder="Например: Финансы, Спорт, Образование..."
              />
            )}
            {errors.subjectArea && (
              <p className="text-sm text-destructive">{errors.subjectArea}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Иконка</Label>
            <div className="flex gap-2 flex-wrap">
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

          {/* Ползунки скоринга */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Весовые коэффициенты скоринга
            </Label>
            <p className="text-xs text-muted-foreground">
              Сумма весов должна быть равна 1.0
            </p>
            {Object.entries(weights).map(([key, value]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">
                    {weightLabels[key as keyof typeof weights]}
                  </Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {value.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={value}
                  onChange={(e) =>
                    updateWeight(
                      key as keyof typeof weights,
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
                />
              </div>
            ))}
            {errors.weights && (
              <p className="text-sm text-destructive">{errors.weights}</p>
            )}
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