import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog';
import { Label } from '@shared/ui/label';
import type { Agent, CreateAgentDto, UpdateAgentDto, ChipFilter } from '@shared/api/client';
import { Shield, Brain, Megaphone, Heart, Paintbrush, Plus, X, GripVertical, Hammer, Wrench } from 'lucide-react';
import { cn } from '@shared/lib/utils';

const SUBJECT_AREAS = [
  { id: 'cybersec', label: 'Информационная безопасность', icon: Shield, color: '#ef4444' },
  { id: 'ai', label: 'Искусственный интеллект', icon: Brain, color: '#8b5cf6' },
  { id: 'marketing', label: 'Маркетинг', icon: Megaphone, color: '#f97316' },
  { id: 'medical', label: 'Медицина', icon: Heart, color: '#06b6d4' },
  { id: 'design', label: 'Графический дизайн', icon: Paintbrush, color: '#ec4899' },
  { id: 'construction', label: 'Строительство и ремонт', icon: Hammer, color: '#f59e0b' },
  { id: 'devops', label: 'Free DevOps & Инжиниринг', icon: Wrench, color: '#10b981' },
];

const COLORS = [
  '#3b82f6', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899', '#10b981', '#6366f1',
];

const DEFAULT_WEIGHTS = {
  aiRelevance: 0.35,
  keywordMatch: 0.25,
  freshness: 0.20,
  sourceTrust: 0.20,
};

function sliderFillStyle(value: number): CSSProperties {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return { '--slider-pct': `${pct}%` } as CSSProperties;
}

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
  const [color, setColor] = useState('#3b82f6');
  const [subjectArea, setSubjectArea] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [tone, setTone] = useState('профессиональный');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [chipFilters, setChipFilters] = useState<Partial<ChipFilter>[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'basic' | 'scoring' | 'filters' | 'prompts'>('basic');

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description || '');
      setIcon(agent.icon || 'bot');
      setColor(agent.color || '#3b82f6');
      setSubjectArea(agent.subjectArea || '');
      setTargetAudience(agent.config?.targetAudience || '');
      setTone(agent.config?.tone || 'профессиональный');
      setSystemPrompt(agent.config?.systemPrompt || '');
      setTags(agent.config?.tags || []);
      setWeights(agent.config?.scoringWeights || DEFAULT_WEIGHTS);
      setChipFilters(agent.chipFilters || agent.config?.chipFilters || []);
    } else {
      setName(''); setDescription(''); setIcon('bot'); setColor('#3b82f6');
      setSubjectArea(''); setTargetAudience(''); setTone('профессиональный');
      setSystemPrompt(''); setTags([]); setWeights(DEFAULT_WEIGHTS); setChipFilters([]);
    }
    setErrors({}); setTab('basic');
  }, [agent, open]);

  // Auto-fill from subject area
  useEffect(() => {
    if (!agent && subjectArea) {
      const area = SUBJECT_AREAS.find(a => a.id === subjectArea);
      if (area) {
        setColor(area.color);
        setName(prev => prev || area.label);
      }
    }
  }, [subjectArea, agent]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Название обязательно';
    if (name.length > 100) newErrors.name = 'Максимум 100 символов';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags(prev => [...prev, tag]);
    }
    setTagInput('');
  }, [tagInput, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  const addChipFilter = useCallback(() => {
    setChipFilters(prev => [...prev, {
      key: `filter_${prev.length}`,
      label: `Фильтр ${prev.length + 1}`,
      operator: 'contains',
      scoreModifier: 0,
      color: 'default',
      isActive: true,
    }]);
  }, []);

  const removeChipFilter = useCallback((index: number) => {
    setChipFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateChipFilter = useCallback((index: number, field: string, value: unknown) => {
    setChipFilters(prev => prev.map((cf, i) => i === index ? { ...cf, [field]: value } : cf));
  }, []);

  const updateWeight = useCallback((key: keyof typeof weights, value: number) => {
    setWeights(prev => {
      const updated = { ...prev, [key]: value };
      // Normalize to sum = 1.0
      const sum = Object.values(updated).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        // Auto-normalize: distribute the difference proportionally
        const diff = 1.0 - sum;
        const otherKeys = (Object.keys(updated) as (keyof typeof weights)[]).filter(k => k !== key);
        const otherSum = otherKeys.reduce((a, k) => a + updated[k], 0);
        if (otherSum > 0) {
          for (const k of otherKeys) {
            updated[k] = Math.max(0, updated[k] + (updated[k] / otherSum) * diff);
          }
        }
      }
      return updated;
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data: CreateAgentDto = {
      name: name.trim(),
      description: description.trim(),
      icon,
      color,
      subjectArea: subjectArea || undefined,
      config: {
        targetAudience: targetAudience.trim() || undefined,
        tone: tone.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        scoringWeights: weights,
        chipFilters: chipFilters.length > 0 ? chipFilters : undefined,
      },
    };

    await onSubmit(agent ? { ...data } : data);
    onOpenChange(false);
  };

  const tabs = [
    { key: 'basic' as const, label: 'Основное' },
    { key: 'scoring' as const, label: 'Веса скоринга' },
    { key: 'filters' as const, label: 'Чип-фильтры' },
    { key: 'prompts' as const, label: 'Промпты' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agent ? 'Редактировать агента' : 'Новый агент'}</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border pb-1">
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors',
                tab === t.key
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* === TAB: Basic === */}
          {tab === 'basic' && (
            <>
              <Input
                label="Название"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                placeholder="Например: Информационная безопасность"
                required
              />

              <div className="space-y-1.5">
                <Label>Описание</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Краткое описание агента..."
                  rows={2}
                  className={cn(
                    'flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors',
                    'placeholder:text-muted-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-accent',
                    'resize-none'
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Предметная область</Label>
                <div className="grid grid-cols-1 gap-2">
                  {SUBJECT_AREAS.map((area) => {
                    const Icon = area.icon;
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => setSubjectArea(subjectArea === area.id ? '' : area.id)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-all text-left',
                          subjectArea === area.id
                            ? 'border-accent bg-accent-light'
                            : 'border-border hover:border-muted-foreground'
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" style={{ color: area.color }} />
                        <span className="text-sm font-medium">{area.label}</span>
                        {subjectArea === area.id && (
                          <span className="ml-auto text-xs text-accent">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Теги / Ключевые слова</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium"
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="Добавить тег..."
                    className={cn(
                      'flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground',
                      'focus:outline-none focus:ring-2 focus:ring-accent'
                    )}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Enter или кнопка + чтобы добавить. Теги используются для поиска и скоринга.</p>
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label>Цвет</Label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        'h-8 w-8 rounded-full transition-all',
                        color === c ? 'ring-2 ring-offset-2 ring-accent scale-110' : 'hover:scale-105'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* === TAB: Scoring Weights === */}
          {tab === 'scoring' && (
            <>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Веса критериев скоринга</h3>
                <p className="text-xs text-muted-foreground">
                  Настройте, какие критерии важнее для этого агента. Сумма весов = 1.0
                </p>
              </div>

              {Object.entries(weights).map(([key, value]) => {
                const labelMap: Record<string, string> = {
                  aiRelevance: 'AI-релевантность',
                  keywordMatch: 'Совпадение ключевых слов',
                  freshness: 'Свежесть новости',
                  sourceTrust: 'Доверие к источнику',
                };
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">{labelMap[key] || key}</Label>
                      <span className="text-sm font-mono text-accent tabular-nums">
                        {(value * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(value * 100)}
                      onChange={(e) => updateWeight(key as keyof typeof weights, Number(e.target.value) / 100)}
                      className="slider-filled w-full cursor-pointer"
                      style={sliderFillStyle(value)}
                    />
                  </div>
                );
              })}

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Сумма весов:</span>
                <span className={cn(
                  'text-sm font-mono tabular-nums',
                  Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 1.0) < 0.02
                    ? 'text-green-500'
                    : 'text-destructive'
                )}>
                  {(Object.values(weights).reduce((a, b) => a + b, 0) * 100).toFixed(0)}%
                </span>
              </div>

              <div className="space-y-1.5">
                <Label>Целевая аудитория</Label>
                <input
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Например: специалисты по кибербезопасности"
                  className={cn(
                    'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-accent'
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Тональность</Label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className={cn(
                    'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-accent'
                  )}
                >
                  <option value="профессиональный">Профессиональный</option>
                  <option value="дружелюбный">Дружелюбный</option>
                  <option value="академический">Академический</option>
                  <option value="неформальный">Неформальный</option>
                  <option value="экспертный">Экспертный</option>
                </select>
              </div>
            </>
          )}

          {/* === TAB: Chip Filters === */}
          {tab === 'filters' && (
            <>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Чип-фильтры</h3>
                <p className="text-xs text-muted-foreground">
                  Фильтры применяются при скоринге. Модифицируют итоговый score статьи.
                </p>
              </div>

              {chipFilters.map((cf, i) => (
                <div key={i} className="p-3 rounded-lg border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <input
                        value={cf.label || ''}
                        onChange={(e) => updateChipFilter(i, 'label', e.target.value)}
                        placeholder="Название фильтра"
                        className="text-sm font-medium bg-transparent border-none focus:outline-none"
                      />
                    </div>
                    <button type="button" onClick={() => removeChipFilter(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Оператор</Label>
                      <select
                        value={cf.operator || 'contains'}
                        onChange={(e) => updateChipFilter(i, 'operator', e.target.value)}
                        className="w-full rounded-md border border-border bg-card px-2 py-1 text-xs"
                      >
                        <option value="contains">Содержит</option>
                        <option value="not_contains">Не содержит</option>
                        <option value="equals">Равно</option>
                        <option value="starts_with">Начинается с</option>
                        <option value="regex">Регулярное выражение</option>
                        <option value="in">В списке</option>
                        <option value="gt">Больше</option>
                        <option value="lt">Меньше</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Модификатор score</Label>
                      <input
                        type="number"
                        step={0.05}
                        min={-1}
                        max={1}
                        value={cf.scoreModifier ?? 0}
                        onChange={(e) => updateChipFilter(i, 'scoreModifier', Number(e.target.value))}
                        className="w-full rounded-md border border-border bg-card px-2 py-1 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Шаблон / Значение</Label>
                    <input
                      value={cf.pattern || ''}
                      onChange={(e) => updateChipFilter(i, 'pattern', e.target.value)}
                      placeholder="Например: уязвимость, CVE, эксплойт"
                      className="w-full rounded-md border border-border bg-card px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={addChipFilter} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Добавить чип-фильтр
              </Button>
            </>
          )}

          {/* === TAB: Prompts === */}
          {tab === 'prompts' && (
            <>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Промпты для генерации</h3>
                <p className="text-xs text-muted-foreground">
                  Эти промпты используются при генерации постов и дайджестов для данного агента.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Системный промпт</Label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Ты — аналитик новостей в области [предметная область]. Твоя задача — анализировать новости, определять их важность и генерировать краткие посты для социальных сетей на русском языке..."
                  rows={6}
                  className={cn(
                    'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-accent',
                    'resize-none font-mono text-xs'
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Тональность генерации</Label>
                <p className="text-xs text-muted-foreground">
                  Текущая: <span className="font-medium text-foreground">{tone}</span>
                </p>
              </div>
            </>
          )}

          <DialogFooter className="pt-4 border-t border-border">
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
