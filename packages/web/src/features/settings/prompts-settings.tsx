import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Textarea } from '@shared/ui/textarea';
import { Label } from '@shared/ui/label';
import { Skeleton } from '@shared/ui/skeleton';
import { useToast } from '@shared/ui/toast';
import { workspaceApi, type WorkspaceConfig } from '@shared/api/client';
import { MessageSquare, Search, Sparkles, BarChart3, Save, RotateCcw } from 'lucide-react';

const DEFAULT_PROMPTS: Required<NonNullable<WorkspaceConfig['prompts']>> = {
  search: `Ты — AI-ассистент по поиску новостей для тематического агента.

ЗАДАЧА: Найди максимально релевантные новости по теме агента.

КРИТЕРИИ ПОИСКА:
1. Релевантность — статья точно соответствует теме и интересам целевой аудитории агента
2. Свежесть — приоритет новостям за последние 24-48 часов
3. Достоверность —优先 авторитетные источники (Хабр, TechCrunch, официальные блоги компаний)
4. Практическая ценность —优先 статьи с конкретными действиями, инструкциями, кейсами
5. Уникальность — не дублировать уже собранные новости

ФОРМАТ ОТВЕТА: JSON массив с полями title, description, url, relevance_score (0-100)`,

  deepsearch: `Ты — AI-аналитик, проводящий глубокое исследование новости.

ЗАДАЧА: Проведи многоуровневый анализ статьи и подготовь исследовательский отчёт.

АЛГОРИТМ:
1. Извлеки ключевые факты, цифры, имена и организации
2. Определи контекст: почему это важно именно сейчас
3. Найди связи с предыдущими событиями и трендами
4. Оцени влияние на отрасль/рынок/сообщество
5. Выяви скрытые последствия и возможные развития
6. Сформируй прогноз: что будет дальше

СТРУКТУРА ОТЧЁТА:
- Краткое резюме (2-3 предложения)
- Ключевые факты
- Контекст и предыстория
- Анализ влияния
- Связанные события
- Прогноз и рекомендации
- Источники для кросс-проверки

Пиши на русском языке, экспертным но доступным тоном.`,

  scoring: `Ты — AI-скорер, оценивающий важность новости для тематического агента.

ЗАДАЧА: Поставь оценку 0-100 по каждому из 4 критериев и рассчитай итоговый score.

КРИТЕРИИ ОЦЕНКИ (каждый 0-100):

1. AI_RELEVANCE — Релевантность
   - 80-100: Точное попадание в тему агента и интересы ЦА
   - 50-79: Смежная тема, может быть полезна
   - 0-49: Слабая связь с темой

2. KEYWORD_MATCH — Совпадение ключевых слов
   - 80-100: Множественные точные совпадения с тегами агента
   - 50-79: Несколько совпадений
   - 0-49: Мало совпадений или их отсутствие

3. FRESHNESS — Свежесть
   - 80-100: Меньше 6 часов
   - 50-79: 6-24 часа
   - 20-49: 1-3 дня
   - 0-19: Старше 3 дней

4. SOURCE_TRUST — Доверие к источнику
   - 80-100: Крупные权威 издания, официальные блоги
   - 50-79: Известные нишевые источники
   - 0-49: Малоизвестные или непроверенные источники

ФОРМАТ ОТВЕТА: JSON { "ai_relevance": N, "keyword_match": N, "freshness": N, "source_trust": N, "reasoning": "краткое обоснование" }`,
};

export function PromptsSettings() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchPrompt, setSearchPrompt] = useState(DEFAULT_PROMPTS.search);
  const [deepsearchPrompt, setDeepsearchPrompt] = useState(DEFAULT_PROMPTS.deepsearch);
  const [scoringPrompt, setScoringPrompt] = useState(DEFAULT_PROMPTS.scoring);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const workspace = await workspaceApi.get();
      const prompts = workspace.config?.prompts;
      if (prompts?.search) setSearchPrompt(prompts.search);
      if (prompts?.deepsearch) setDeepsearchPrompt(prompts.deepsearch);
      if (prompts?.scoring) setScoringPrompt(prompts.scoring);
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await workspaceApi.updateConfig({
        prompts: {
          search: searchPrompt,
          deepsearch: deepsearchPrompt,
          scoring: scoringPrompt,
        },
      });
      addToast({ title: 'Промпты сохранены', variant: 'success' });
    } catch (err) {
      addToast({
        title: 'Ошибка сохранения',
        description: err instanceof Error ? err.message : '',
        variant: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSearchPrompt(DEFAULT_PROMPTS.search);
    setDeepsearchPrompt(DEFAULT_PROMPTS.deepsearch);
    setScoringPrompt(DEFAULT_PROMPTS.scoring);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Промпты</h2>
          <p className="text-sm text-muted-foreground">
            Настройка промптов для поиска, глубокого анализа и скоринга
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Сбросить</span>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Search className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Промпт поиска</CardTitle>
              <CardDescription>Инструкция для AI при поиске релевантных новостей по теме агента</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={searchPrompt}
            onChange={(e) => setSearchPrompt(e.target.value)}
            rows={4}
            className="resize-y"
            placeholder="Введите промпт для поиска..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Промпт глубокого поиска (Deep Search)</CardTitle>
              <CardDescription>Инструкция для AI при проведении глубокого анализа и исследования темы</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={deepsearchPrompt}
            onChange={(e) => setDeepsearchPrompt(e.target.value)}
            rows={4}
            className="resize-y"
            placeholder="Введите промпт для глубокого поиска..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Промпт скоринга</CardTitle>
              <CardDescription>Инструкция для AI при оценке релевантности и важности статей</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={scoringPrompt}
            onChange={(e) => setScoringPrompt(e.target.value)}
            rows={4}
            className="resize-y"
            placeholder="Введите промпт для скоринга..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
