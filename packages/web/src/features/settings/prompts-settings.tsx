import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Textarea } from '@shared/ui/textarea';
import { Skeleton } from '@shared/ui/skeleton';
import { useToast } from '@shared/ui/toast';
import { workspaceApi, type WorkspaceConfig } from '@shared/api/client';
import { Search, Sparkles, BarChart3, Save, RotateCcw, Newspaper, BookOpen } from 'lucide-react';

const DEFAULT_PROMPTS: Required<NonNullable<WorkspaceConfig['prompts']>> = {
  search: `Ты — AI-ассистент по поиску новостей для тематического агента.

ЗАДАЧА: Найди максимально релевантные новости по теме агента.

КРИТЕРИИ ПОИСКА:
1. Релевантность — статья точно соответствует теме и интересам целевой аудитории агента
2. Свежесть — приоритет новостям за последние 24-48 часов
3. Достоверность — приоритет авторитетные источники (Хабр, TechCrunch, официальные блоги компаний)
4. Практическая ценность — приоритет статьи с конкретными действиями, инструкциями, кейсами
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
   - 80-100: Крупные авторитетные издания, официальные блоги
   - 50-79: Известные нишевые источники
   - 0-49: Малоизвестные или непроверенные источники

ФОРМАТ ОТВЕТА: JSON { "ai_relevance": N, "keyword_match": N, "freshness": N, "source_trust": N, "reasoning": "краткое обоснование" }`,

  post_generation: `Ты — профессиональный редактор новостного контента. Твоя задача — создать увлекательный пост на основе предоставленных новостных статей.

ПРАВИЛА:
1. Пиши на русском языке
2. Используй информативный, но доступный стиль
3. Начинай с самого важного — ключевой факт или инсайт
4. Подкрепляй утверждения конкретными данными из источников
5. Добавляй контекст: почему это важно именно сейчас
6. Завершай резюме или прогнозом

СТРУКТУРА ПОСТА:
- Заголовок (краткий, цепляющий)
- Лид (1-2 предложения — суть новости)
- Основная часть (факты, данные, цитаты)
- Контекст и анализ
- Вывод / прогноз

ИСПОЛЬЗУЙ переменную {{content}} для подстановки текста статей.`,

  digest_generation: `Ты — профессиональный аналитик новостей. Твоя задача — подготовить структурированный дайджест на основе нескольких новостных статей по теме.

ПРАВИЛА:
1. Пиши на русском языке
2. Группируй новости по темам и значимости
3. Для каждой темы: краткое резюме + ключевые факты + вывод
4. Избегай дублирования — если несколько статей об одном, объединяй
5. Добавляй аналитический контекст и прогнозы
6. Указывай источники

СТРУКТУРА ДАЙДЖЕСТА:
- Заголовок дайджеста (тема + период)
- Самое важное за период (3-5 ключевых событий)
- Детальный разбор по темам
  * Тема 1: суть → факты → значение
  * Тема 2: ...
- Тренды и закономерности
- Прогноз и рекомендации
- Источники

ИСПОЛЬЗУЙ переменную {{content}} для подстановки текста статей.`,
};

export function PromptsSettings() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchPrompt, setSearchPrompt] = useState(DEFAULT_PROMPTS.search);
  const [deepsearchPrompt, setDeepsearchPrompt] = useState(DEFAULT_PROMPTS.deepsearch);
  const [scoringPrompt, setScoringPrompt] = useState(DEFAULT_PROMPTS.scoring);
  const [postGenerationPrompt, setPostGenerationPrompt] = useState(DEFAULT_PROMPTS.post_generation);
  const [digestGenerationPrompt, setDigestGenerationPrompt] = useState(DEFAULT_PROMPTS.digest_generation);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const workspace = await workspaceApi.get();
      const prompts = workspace.config?.prompts;
      if (prompts?.search) setSearchPrompt(prompts.search);
      if (prompts?.deepsearch) setDeepsearchPrompt(prompts.deepsearch);
      if (prompts?.scoring) setScoringPrompt(prompts.scoring);
      if (prompts?.post_generation) setPostGenerationPrompt(prompts.post_generation);
      if (prompts?.digest_generation) setDigestGenerationPrompt(prompts.digest_generation);
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
          post_generation: postGenerationPrompt,
          digest_generation: digestGenerationPrompt,
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
    setPostGenerationPrompt(DEFAULT_PROMPTS.post_generation);
    setDigestGenerationPrompt(DEFAULT_PROMPTS.digest_generation);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
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
            Настройка промптов для всех AI-операций
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

      {/* Post Generation Prompt */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600">
              <Newspaper className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Промпт генерации постов</CardTitle>
              <CardDescription>Базовая инструкция для AI при создании постов из новостных статей. Используется как system prompt если не выбран шаблон</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={postGenerationPrompt}
            onChange={(e) => setPostGenerationPrompt(e.target.value)}
            rows={6}
            className="resize-y"
            placeholder="Введите промпт для генерации постов..."
          />
        </CardContent>
      </Card>

      {/* Digest Generation Prompt */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Промпт генерации дайджестов</CardTitle>
              <CardDescription>Базовая инструкция для AI при создании дайджестов. Используется как system prompt если не выбран шаблон</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={digestGenerationPrompt}
            onChange={(e) => setDigestGenerationPrompt(e.target.value)}
            rows={6}
            className="resize-y"
            placeholder="Введите промпт для генерации дайджестов..."
          />
        </CardContent>
      </Card>

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
