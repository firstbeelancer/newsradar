import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog';
import { Label } from '@shared/ui/label';
import { Badge } from '@shared/ui/badge';
import type { Agent, CreateAgentDto, UpdateAgentDto, ChipFilter } from '@shared/api/client';
import { chipFiltersApi } from '@shared/api/client';
import { Shield, Brain, Megaphone, Heart, Paintbrush, Plus, X, GripVertical, Hammer, Wrench, Bot, Globe, Zap, Star, Eye, Search, BookOpen, Rss, MessageCircle, Target, Lightbulb, Compass, Newspaper, Settings2, Sliders, Filter, MessageSquare, type LucideIcon } from 'lucide-react';
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
  '#f59e0b', '#14b8a6', '#e11d48', '#7c3aed',
];

const ICON_OPTIONS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: 'bot', icon: Bot, label: 'Бот' },
  { id: 'shield', icon: Shield, label: 'Щит' },
  { id: 'brain', icon: Brain, label: 'Мозг' },
  { id: 'megaphone', icon: Megaphone, label: 'Мегафон' },
  { id: 'heart', icon: Heart, label: 'Сердце' },
  { id: 'paintbrush', icon: Paintbrush, label: 'Кисть' },
  { id: 'hammer', icon: Hammer, label: 'Молоток' },
  { id: 'wrench', icon: Wrench, label: 'Гаечный ключ' },
  { id: 'globe', icon: Globe, label: 'Глобус' },
  { id: 'zap', icon: Zap, label: 'Молния' },
  { id: 'star', icon: Star, label: 'Звезда' },
  { id: 'eye', icon: Eye, label: 'Глаз' },
  { id: 'search', icon: Search, label: 'Поиск' },
  { id: 'book', icon: BookOpen, label: 'Книга' },
  { id: 'rss', icon: Rss, label: 'RSS' },
  { id: 'message', icon: MessageCircle, label: 'Сообщение' },
  { id: 'target', icon: Target, label: 'Цель' },
  { id: 'lightbulb', icon: Lightbulb, label: 'Лампа' },
  { id: 'compass', icon: Compass, label: 'Компас' },
  { id: 'newspaper', icon: Newspaper, label: 'Газета' },
];

const DEFAULT_WEIGHTS = {
  relevance: 30,
  novelty: 25,
  hype: 20,
  practical: 15,
  local: 10,
};

const DEFAULT_CHIP_FILTERS: Partial<ChipFilter>[] = [
  { key: 'breaking', label: 'Срочное', operator: 'contains', pattern: 'срочно,экстренно,breaking,urgent', scoreModifier: 15, color: '#ef4444', icon: 'zap', isActive: true },
  { key: 'exclusive', label: 'Эксклюзив', operator: 'contains', pattern: 'эксклюзив,exclusive,первоисточник', scoreModifier: 10, color: '#8b5cf6', icon: 'star', isActive: true },
  { key: 'trending', label: 'Тренд', operator: 'contains', pattern: 'тренд,хайп,viral,популярн', scoreModifier: 8, color: '#f97316', icon: 'trending-up', isActive: true },
  { key: 'actionable', label: 'Actionable', operator: 'contains', pattern: 'как,пошагов,instruction,руководство,гайд', scoreModifier: 6, color: '#06b6d4', icon: 'check-circle', isActive: true },
  { key: 'spam', label: 'Спам', operator: 'contains', pattern: 'реклама,акция,скидка,promo,промо', scoreModifier: -12, color: '#6b7280', icon: 'x-circle', isActive: true },
];

function sliderFillStyle(value: number): CSSProperties {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return { '--slider-pct': `${pct}%` } as CSSProperties;
}

export function parseScoreModifierInput(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface AgentFormProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateAgentDto | UpdateAgentDto) => Promise<Agent | void>;
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
  const [loadedFilterIds, setLoadedFilterIds] = useState<Set<string>>(new Set());
  const [customSubjectArea, setCustomSubjectArea] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'basic' | 'scoring' | 'filters' | 'prompts'>('basic');

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description || '');
      setIcon(agent.icon || 'bot');
      setColor(agent.color || '#3b82f6');
      const sa = agent.subjectArea || '';
      const isPreset = SUBJECT_AREAS.some(a => a.id === sa);
      setSubjectArea(isPreset ? sa : '');
      setCustomSubjectArea(isPreset ? '' : sa);
      setTargetAudience(agent.config?.targetAudience || '');
      setTone(agent.config?.tone || 'профессиональный');
      setSystemPrompt(agent.config?.systemPrompt || '');
      setTags(agent.config?.tags || []);
      setWeights(agent.config?.scoringWeights || DEFAULT_WEIGHTS);
      // Load chip filters from API
      chipFiltersApi.list(agent.id).then((filters) => {
        setChipFilters(filters);
        setLoadedFilterIds(new Set(filters.map(f => f.id)));
      }).catch(() => {
        setChipFilters(agent.chipFilters?.length ? agent.chipFilters : (agent.config?.chipFilters || [...DEFAULT_CHIP_FILTERS]));
        setLoadedFilterIds(new Set());
      });
    } else {
      setName(''); setDescription(''); setIcon('bot'); setColor('#3b82f6');
      setSubjectArea(''); setCustomSubjectArea(''); setTargetAudience(''); setTone('профессиональный');
      setSystemPrompt(''); setTags([]); setWeights(DEFAULT_WEIGHTS); setChipFilters([...DEFAULT_CHIP_FILTERS]);
      setLoadedFilterIds(new Set());
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
    setWeights(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const finalSubjectArea = customSubjectArea.trim() || subjectArea || undefined;

    const data: CreateAgentDto = {
      name: name.trim(),
      description: description.trim(),
      icon,
      color,
      subjectArea: finalSubjectArea,
      config: {
        targetAudience: targetAudience.trim() || undefined,
        tone: tone.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        scoringWeights: weights,
      },
    };

    // Submit agent data — for new agents, onSubmit should return the created agent
    const result = await onSubmit(agent ? { ...data } : data);

    // Resolve agent ID: existing agent or newly created from store
    const agentId = agent?.id || result?.id;

    if (agentId) {
      try {
        const currentIds = new Set(chipFilters.filter(f => f.id).map(f => f.id!));
        const toDelete = [...loadedFilterIds].filter(id => !currentIds.has(id));

        for (const cf of chipFilters) {
          if (cf.id && loadedFilterIds.has(cf.id)) {
            await chipFiltersApi.update(cf.id, {
              key: cf.key,
              label: cf.label,
              pattern: cf.pattern,
              operator: cf.operator,
              scoreModifier: cf.scoreModifier,
              color: cf.color,
              icon: cf.icon,
              isActive: cf.isActive,
            });
          } else {
            await chipFiltersApi.create(agentId, {
              key: cf.key || `filter_${Date.now()}`,
              label: cf.label || 'Фильтр',
              pattern: cf.pattern,
              operator: cf.operator || 'contains',
              scoreModifier: cf.scoreModifier ?? 0,
              color: cf.color || 'default',
              icon: cf.icon,
              isActive: cf.isActive ?? true,
            });
          }
        }

        for (const id of toDelete) {
          await chipFiltersApi.delete(id);
        }
      } catch (err) {
        console.error('Failed to save chip filters:', err);
      }
    }

    onOpenChange(false);
  };

  const tabs = [
    { key: 'basic' as const, label: 'Основное', icon: Settings2 },
    { key: 'scoring' as const, label: 'Скоринг', icon: Sliders },
    { key: 'filters' as const, label: 'Чип-фильтры', icon: Filter },
    { key: 'prompts' as const, label: 'Промпты', icon: MessageSquare },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 w-[95vw] sm:w-auto">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0">
          <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
            {agent ? 'Редактировать агента' : 'Новый агент'}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-0.5 sm:gap-1 border-b border-border/60 bg-muted/40 backdrop-blur-sm px-2 sm:px-4 py-0 mx-3 sm:mx-6 rounded-t-xl overflow-x-auto">
          {tabs.map(t => {
            const TabIcon = t.icon;
            const mobileLabels: Record<string, string> = {
              basic: 'Основное',
              scoring: 'Скоринг',
              filters: 'Фильтры',
              prompts: 'Промпт',
            };
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-medium transition-all relative whitespace-nowrap',
                  tab === t.key
                    ? 'text-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-t-lg'
                )}
              >
                <TabIcon className="h-3.5 w-3.5 shrink-0" />
                <span>{mobileLabels[t.key] ?? t.label}</span>
                {tab === t.key && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-5">
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
                    'flex w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground transition-colors',
                    'placeholder:text-muted-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-accent focus:bg-muted/20',
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
                        onClick={() => { setSubjectArea(subjectArea === area.id ? '' : area.id); setCustomSubjectArea(''); }}
                        className={cn(
                          'flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 transition-all text-left',
                          subjectArea === area.id
                            ? 'border-accent bg-accent-light shadow-sm'
                            : 'border-border/80 hover:border-muted-foreground/40 hover:bg-muted/30'
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
                <div className="mt-2 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Или укажите свою предметную область:</Label>
                  <Input
                    value={customSubjectArea}
                    onChange={(e) => { setCustomSubjectArea(e.target.value); if (e.target.value) setSubjectArea(''); }}
                    placeholder="Например: Финтех, E-commerce, Автопром..."
                    className="rounded-lg"
                  />
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
                      'flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground',
                      'focus:outline-none focus:ring-2 focus:ring-accent'
                    )}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Enter или кнопка + чтобы добавить. Теги используются для поиска и скоринга.</p>
              </div>

              {/* Icon */}
              <div className="space-y-2">
                <Label>Иконка</Label>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-2">
                  {ICON_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setIcon(opt.id)}
                        title={opt.label}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all',
                          icon === opt.id
                            ? 'border-accent bg-accent-light text-accent scale-110 shadow-sm'
                            : 'border-border/80 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground hover:bg-muted/30'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label>Цвет</Label>
                <div className="flex flex-wrap gap-2">
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
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold">Веса критериев AI-скоринга</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  AI оценивает новость по 5 критериям (0–100), а итог считается как взвешенное среднее.
                  Важна относительная сила весов, а не точная сумма 100.
                </p>
              </div>

              <div className="space-y-4">
                {Object.entries(weights).map(([key, value]) => {
                  const labelMap: Record<string, string> = {
                    relevance: 'Релевантность',
                    novelty: 'Новизна',
                    hype: 'Вирусный потенциал',
                    practical: 'Практическая польза',
                    local: 'Локальный контекст (РФ)',
                  };
                  const descMap: Record<string, string> = {
                    relevance: 'Соответствие теме агента и интересам аудитории',
                    novelty: 'Свежесть новости, не повторяет старые темы',
                    hype: 'Потенциал для обсуждения, репостов, интереса',
                    practical: 'Применимость в работе, бизнесе, ИТ',
                    local: 'Актуальность для РФ и русскоязычной аудитории',
                  };
                  const colorMap: Record<string, string> = {
                    relevance: '#3b82f6',
                    novelty: '#8b5cf6',
                    hype: '#f97316',
                    practical: '#10b981',
                    local: '#06b6d4',
                  };
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: colorMap[key] || '#94a3b8' }}
                          />
                          <Label className="text-sm">{labelMap[key] || key}</Label>
                        </div>
                        <span className="text-sm font-mono text-accent tabular-nums font-medium">
                          {value}%
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground pl-4">{descMap[key] || ''}</p>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={value}
                        onChange={(e) => updateWeight(key as keyof typeof weights, Number(e.target.value))}
                        className="slider-filled w-full cursor-pointer"
                        style={sliderFillStyle(value / 100)}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-border/60 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Сумма весов:</span>
                  <span className={cn(
                    'text-sm font-mono tabular-nums font-bold',
                    'text-accent'
                  )}>
                    {Object.values(weights).reduce((a, b) => a + b, 0)}%
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Сумма показывается для ориентира. Формула нормализует веса сама.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-accent/5 border border-accent/15 backdrop-blur-sm">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Гибридная формула:</strong> AI оценивает по 5 критериям → base_score = SUM(score × weight) / SUM(weight).
                  Затем: <code className="text-[11px] bg-muted px-1 py-0.5 rounded font-mono">hybrid = ai_score×0.55 + keyword×0.20 + freshness×0.15 + source_trust×0.10</code>, после чего chip-фильтры добавляют или уменьшают итоговый score.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Целевая аудитория</Label>
                  <input
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="Например: специалисты по кибербезопасности"
                    className={cn(
                      'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground',
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
                      'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground',
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
              </div>
            </>
          )}

          {/* === TAB: Chip Filters === */}
          {tab === 'filters' && (
            <>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold">Чип-фильтры</h3>
                  <Badge variant="outline" className="text-[10px]">{chipFilters.length}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Фильтры применяются при скоринге. Модифицируют итоговый score статьи.
                </p>
              </div>

              <div className="space-y-3">
                {chipFilters.map((cf, i) => (
                  <div
                    key={i}
                    className="group relative p-4 rounded-xl border border-border/60 bg-white/60 backdrop-blur-sm hover:border-accent/30 hover:shadow-sm transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-3 w-3 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-card"
                          style={{
                            backgroundColor: cf.color && cf.color !== 'default' ? cf.color : '#94a3b8',
                            ringColor: cf.color && cf.color !== 'default' ? cf.color : '#94a3b8',
                          }}
                        />
                        <input
                          value={cf.label || ''}
                          onChange={(e) => updateChipFilter(i, 'label', e.target.value)}
                          placeholder="Название фильтра"
                          className="text-sm font-semibold bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground/50"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeChipFilter(i)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded-md hover:bg-destructive/10"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Оператор</Label>
                        <select
                          value={cf.operator || 'contains'}
                          onChange={(e) => updateChipFilter(i, 'operator', e.target.value)}
                          className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                          <option value="contains">Содержит</option>
                          <option value="not_contains">Не содержит</option>
                          <option value="equals">Равно</option>
                          <option value="starts_with">Начинается с</option>
                          <option value="regex">Регулярное выражение</option>
                          <option value="in">В списке</option>
                          <option value="gt">Больше</option>
                          <option value="lt">Меньше</option>
                          <option value="gte">Больше или равно</option>
                          <option value="lte">Меньше или равно</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Модификатор score</Label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={cf.scoreModifier ?? 0}
                          onChange={(e) => updateChipFilter(i, 'scoreModifier', parseScoreModifierInput(e.target.value))}
                          className={cn(
                            'w-full rounded-lg border bg-card px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent',
                            (cf.scoreModifier ?? 0) > 0 ? 'border-green-300 text-green-700' :
                            (cf.scoreModifier ?? 0) < 0 ? 'border-red-300 text-red-700' :
                            'border-border'
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Шаблон / Значение</Label>
                      <input
                        value={cf.pattern || ''}
                        onChange={(e) => updateChipFilter(i, 'pattern', e.target.value)}
                        placeholder="Например: уязвимость, CVE, эксплойт"
                        className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>

                    {/* Color chips */}
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Цвет</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {COLORS.slice(0, 8).map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => updateChipFilter(i, 'color', c)}
                            className={cn(
                              'h-5 w-5 rounded-full transition-all border-2',
                              cf.color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" onClick={addChipFilter} className="w-full border-dashed">
                <Plus className="h-4 w-4 mr-2" /> Добавить чип-фильтр
              </Button>
            </>
          )}

          {/* === TAB: Prompts === */}
          {tab === 'prompts' && (
            <>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold">Промпты для генерации</h3>
                </div>
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
                  rows={8}
                  className={cn(
                    'w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card',
                    'resize-none font-mono text-xs leading-relaxed'
                  )}
                />
                <p className="text-[11px] text-muted-foreground">
                  Используйте переменные: {'{title}'}, {'{description}'}, {'{source}'}, {'{agentName}'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/50 border border-border/60">
                <div className="flex items-center gap-2 mb-1">
                  <Label className="text-xs font-medium">Текущая тональность:</Label>
                  <Badge variant="outline" className="text-[10px]">{tone}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Тональность настраивается во вкладке «Скоринг»
                </p>
              </div>
            </>
          )}

          <DialogFooter className="pt-4 border-t border-border/60 px-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" loading={isSubmitting} className="min-w-[140px] shadow-md shadow-accent/20">
              {agent ? 'Сохранить' : 'Создать агента'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
