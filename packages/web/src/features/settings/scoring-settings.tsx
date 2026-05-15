import { useState, useEffect } from 'react';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Skeleton } from '@shared/ui/skeleton';
import { useSettingsStore } from '@shared/stores/settings-store';
import { useToast } from '@shared/ui/toast';
import { cn } from '@shared/lib/utils';
import { BarChart3, RotateCcw, Save, Filter } from 'lucide-react';

const SLIDER_CONFIG = [
  { key: 'ai_relevance' as const, label: 'AI релевантность', description: 'Оценка релевантности статьи теме агента', min: 0, max: 1, step: 0.05 },
  { key: 'keyword_match' as const, label: 'Совпадение ключевых слов', description: 'Соответствие ключевых слов агента', min: 0, max: 1, step: 0.05 },
  { key: 'freshness' as const, label: 'Свежесть', description: 'Время публикации статьи', min: 0, max: 1, step: 0.05 },
  { key: 'source_trust' as const, label: 'Доверие к источнику', description: 'Рейтинг доверия к источнику', min: 0, max: 1, step: 0.05 },
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

  const [localWeights, setLocalWeights] = useState<Record<string, number>>({});
  const [chipToggles, setChipToggles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchScoringConfig();
  }, [fetchScoringConfig]);

  useEffect(() => {
    if (scoringConfig) {
      setLocalWeights({
        ai_relevance: scoringConfig.ai_relevance,
        keyword_match: scoringConfig.keyword_match,
        freshness: scoringConfig.freshness,
        source_trust: scoringConfig.source_trust,
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

  const handleSliderChange = (key: string, value: number) => {
    setLocalWeights((prev) => {
      const updated = { ...prev, [key]: value };
      // Auto-normalize: distribute the difference proportionally to other keys
      const sum = Object.values(updated).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1.0) > 0.01 && sum > 0) {
        const diff = 1.0 - sum;
        const otherKeys = Object.keys(updated).filter((k) => k !== key);
        const otherSum = otherKeys.reduce((a, k) => a + updated[k], 0);
        if (otherSum > 0) {
          for (const k of otherKeys) {
            updated[k] = Math.max(0, updated[k] + (updated[k] / otherSum) * diff);
          }
        } else {
          // All other weights are 0, distribute equally
          const share = diff / otherKeys.length;
          for (const k of otherKeys) {
            updated[k] = Math.max(0, share);
          }
        }
      }
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      await updateScoringConfig({
        ai_relevance: localWeights.ai_relevance ?? 0.4,
        keyword_match: localWeights.keyword_match ?? 0.3,
        freshness: localWeights.freshness ?? 0.2,
        source_trust: localWeights.source_trust ?? 0.1,
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Настройки скоринга</h2>
        <p className="text-sm text-muted-foreground">Веса факторов ранжирования статей</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Веса факторов
          </CardTitle>
          <CardDescription>
            Сумма весов должна быть равна 1.0 для корректной работы
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {SLIDER_CONFIG.map((config) => {
            const value = localWeights[config.key] ?? config.max / 2;
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
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  value={value}
                  onChange={(e) => handleSliderChange(config.key, parseFloat(e.target.value))}
                  className="slider-filled w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{ '--slider-pct': `${((value - config.min) / (config.max - config.min)) * 100}%` } as React.CSSProperties}
                />
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="text-sm">
              <span className="text-muted-foreground">Сумма весов: </span>
              <span className={
                Math.abs(Object.values(localWeights).reduce((a, b) => a + b, 0) - 1) < 0.01
                  ? 'font-medium text-success'
                  : 'font-medium text-warning'
              }>
                {(Object.values(localWeights).reduce((a, b) => a + b, 0) || 0).toFixed(2)}
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
