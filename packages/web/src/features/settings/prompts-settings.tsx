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
  search: 'Найди релевантные новости по теме агента. Ищи свежие статьи, аналитику и обзоры. Приоритет — источники с высокой достоверностью.',
  deepsearch: 'Проведи глубокий анализ темы. Найди экспертные мнения, исследования, технические разборы и скрытые тренды. Используй несколько источников для кросс-проверки фактов.',
  scoring: 'Оцени релевантность статьи для целевой аудитории агента. Учитывай: 1) Точность соответствия теме 2) Новизну информации 3) Практическую ценность 4) Достоверность источника 5) Актуальность для российского контекста.',
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
