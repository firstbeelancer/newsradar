import { useState, useEffect } from 'react';
import { Button } from '@shared/ui/button';
import { cn } from '@shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Skeleton } from '@shared/ui/skeleton';
import { useSettingsStore } from '@shared/stores/settings-store';
import { useToast } from '@shared/ui/toast';
import { BarChart3, RotateCcw, Save, Filter, Brain, Sliders } from 'lucide-react';
import type { AIScoringWeights } from '@shared/api/client';

// AI sub-criteria sliders (0-100 scale, values sum to 100)
const AI_CRITERIA_CONFIG = [
  { key: 'relevance' as const, label: 'Релевантность', description: 'Насколько статья относится к теме агента', icon: '🎯' },
  { key: 'novelty' as const, label: 'Новизна', description: 'Насколько информация свежая и уникальная', icon: '✨' },
  { key: 'hype' as const, label: 'Хайп', description: 'Вирусный потенциал статьи', icon: '🔥' },
  { key: 'practical' as const, label: 'Практичность', description: 'Практическая польза информации', icon: '🛠' },
  { key: 'local' as const, label: 'Локальность', description: 'Релевантность российскому контексту', icon: '🇷🇺' },
];

// Meta weights sliders (0-1 scale, sum to 1.0)
const META_WEIGHTS_CONFIG = [
  { key: 'ai_weight' as const, label: 'AI-оценка', description: 'Вес составной AI-оценки (5 критериев)', max: 1, step: 0.05 },
  { key: 'keyword_weight' as const, label: 'Ключевые слова', description: 'Вес совпадения ключевых слов', max: 1, step: 0.05 },
  { key: 'freshness_weight' as const, label: 'Свежесть', description: 'Вес свежести публикации', max: 1, step: 0.05 },
  { key: 'source_trust_weight' as const, label: 'Доверие к источнику', description: 'Вес рейтинга источника', max: 1, step: 0.05 },
];

const CHIP_FILTERS = [
  { key: 'exclusive' as const, label: 'Эксклюзив', description: 'Приоритет уникальным материалам' },
  { key: 'actionable' as const, label: 'Actionable', description: 'Статьи с конкретными действиями' },
  { key: 'trending' as const, label: 'Трендинг', description: 'Популярные темы в источниках' },
  { key: 'controversy' as const, label: 'Контроверсия', description: 'Противоречивые материалы' },
  { key: 'verified' as const, label: 'Проверено', description: 'Только из проверенных источников' },
] as const;

export function ScoringSettings() {
  const { addToast } = useToast();
  const {
    scoringConfig,
    isScoringLoading,
    isRecalculating,
    fetchScoringConfig,
    updateScoringConfig,
    recalculateScoring,
  } = useSettingsStore();

  const [localAIWeights, setLocalAIWeights] = useState<AIScoringWeights>({
    relevance: 30,
    novelty: 25,
    hype: 15,
    practical: 20,
    local: 10,
  });
  const [localMetaWeights, setLocalMetaWeights] = useState<Record<string, number>>({});
  const [chipToggles, setChipToggles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchScoringConfig();
  }, [fetchScoringConfig]);

  useEffect(() => {
    if (scoringConfig) {
      setLocalAIWeights(scoringConfig.scoring_weights ?? { relevance: 30, novelty: 25, hype: 15, practical: 20, local: 10 });
      setLocalMetaWeights({
        ai_weight: scoringConfig.ai_weight ?? 0.55,
        keyword_weight: scoringConfig.keyword_weight ?? 0.20,
        freshness_weight: scoringConfig.freshness_weight ?? 0.15,
        source_trust_weight: scoringConfig.source_trust_weight ?? 0.10,
      });
      setChipToggles({
        exclusive: scoringConfig.exclusive ?? false,
        actionable: scoringConfig.actionable ?? false,
        trending: scoringConfig.trending ?? false,
        controversy: scoringConfig.controversy ?? false,
        verified: scoringConfig.verified ?? false,
      });
    }
  }, [scoringConfig]);

  const handleAIWeightChange = (key: keyof AIScoringWeights, value: number) => {
    setLocalAIWeights((prev) => ({ ...prev, [key]: value }));
  };

  const handleMetaWeightChange = (key: string, value: number) => {
    setLocalMetaWeights((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      await updateScoringConfig({
        ai_relevance: scoringConfig?.ai_relevance ?? 0.35,
        keyword_match: scoringConfig?.keyword_match ?? 0.25,
        freshness: scoringConfig?.freshness ?? 0.20,
        source_trust: scoringConfig?.source_trust ?? 0.20,
        ai_weight: localMetaWeights.ai_weight ?? 0.55,
        keyword_weight: localMetaWeights.keyword_weight ?? 0.20,
        freshness_weight: localMetaWeights.freshness_weight ?? 0.15,
        source_trust_weight: localMetaWeights.source_trust_weight ?? 0.10,
        scoring_weights: localAIWeights,
        exclusive: chipToggles.exclusive ?? false,
        actionable: chipToggles.actionable ?? false,
        trending: chipToggles.trending ?? false,
        controversy: chipToggles.controversy ?? false,
        verified: chipToggles.verified ?? false,
      });
      addToast({ title: 'Сохранено', description: 'Настройки скоринга обновлены', variant: 'success' });
    } catch {
      // Error handled by store
    }
  };

  const toggleChip = (key: string) => {
    setChipToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRecalculate = async () => {
    try {
      await recalculateScoring();
      addToast({ title: 'Запущено', description: 'Перескоринг всех статей начат', variant: 'success' });
    } catch {
      // Error handled by store
    }
  };

  if (isScoringLoading && !scoringConfig) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const aiWeightsSum = Object.values(localAIWeights).reduce((a, b) => a + b, 0);
  const metaWeightsSum = Object.values(localMetaWeights).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Настройки скоринга</h2>
        <p className="text-sm text-muted-foreground">Гибридная модель: 5 AI-критериев + 4 мета-веса</p>
      </div>

      {/* AI Sub-criteria Weights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI-критерии (5 факторов)
          </CardTitle>
          <CardDescription>
            Каждый критерий оценивается от 0 до 100. Веса определяют вклад каждого в итоговый AI-скор.
            Сумма весов: {aiWeightsSum}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {AI_CRITERIA_CONFIG.map((config) => {
            const value = localAIWeights[config.key] ?? 0;
            return (
              <div key={config.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{config.icon}</span>
                    <div>
                      <label className="text-sm font-medium">{config.label}</label>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </div>
                  </div>
                  <span className="text-sm font-mono font-medium bg-muted px-2 py-0.5 rounded">
                    {value}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={value}
                  onChange={(e) => handleAIWeightChange(config.key, parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-accent"
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Meta Weights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="h-5 w-5" />
            Мета-веса гибридной формулы
          </CardTitle>
          <CardDescription>
            Определяют вклад каждого типа оценки в финальный скор.
            Сумма весов: <span className={cn(
              Math.abs(metaWeightsSum - 1) < 0.01 ? 'text-success font-medium' : 'text-warning font-medium'
            )}>{metaWeightsSum.toFixed(2)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {META_WEIGHTS_CONFIG.map((config) => {
            const value = localMetaWeights[config.key] ?? 0;
            return (
              <div key={config.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">{config.label}</label>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                  <span className="text-sm font-mono font-medium bg-muted px-2 py-0.5 rounded">
                    {value.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={config.max}
                  step={config.step}
                  value={value}
                  onChange={(e) => handleMetaWeightChange(config.key, parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-accent"
                />
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="text-sm">
              <span className="text-muted-foreground">Формула: </span>
              <span className="font-mono text-xs">
                AI×{localMetaWeights.ai_weight?.toFixed(2) ?? '0.55'} + KW×{localMetaWeights.keyword_weight?.toFixed(2) ?? '0.20'} + F×{localMetaWeights.freshness_weight?.toFixed(2) ?? '0.15'} + ST×{localMetaWeights.source_trust_weight?.toFixed(2) ?? '0.10'}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecalculate}
                loading={isRecalculating}
              >
                {!isRecalculating && <RotateCcw className="h-4 w-4" />}
                Перескорить
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4" />
                Сохранить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chip Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Фильтры скоринга
          </CardTitle>
          <CardDescription>
            Включите дополнительные факторы для тонкой настройки ранжирования
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CHIP_FILTERS.map((chip) => {
              const isActive = chipToggles[chip.key] ?? false;
              return (
                <button
                  key={chip.key}
                  onClick={() => toggleChip(chip.key)}
                  className={cn(
                    'relative flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'border-accent bg-accent-light text-accent'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  title={chip.description}
                >
                  <div className={cn(
                    'h-2 w-2 rounded-full transition-colors',
                    isActive ? 'bg-accent' : 'bg-muted-foreground/30'
                  )} />
                  {chip.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Нажмите на фильтр для включения/выключения. Сохраните изменения кнопкой выше.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
