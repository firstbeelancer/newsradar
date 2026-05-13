import { useState, useEffect, useRef } from 'react';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select';
import { useGenerationStore } from '@shared/stores/generation-store';
import { useAgentsStore } from '@shared/stores/agents-store';
import { useSettingsStore } from '@shared/stores/settings-store';
import { SSEStream } from './sse-stream';
import { GenerationResult } from './generation-result';
import { Sparkles } from 'lucide-react';

const DEFAULT_TEMPLATE_VALUE = '__default_template__';

export function DigestGenerator() {
  const {
    selectedAgentId,
    selectedPeriod,
    selectedTemplateId,
    selectedProvider,
    selectedModel,
    streamContent,
    isStreaming,
    isGenerating,
    opId,
    streamError,
    setSelectedAgentId,
    setSelectedPeriod,
    setSelectedTemplateId,
    setSelectedProvider,
    setSelectedModel,
    generateDigest,
    startStream,
    resetGeneration,
  } = useGenerationStore();

  const { agents, fetchAgents } = useAgentsStore();
  const { templates, fetchTemplates } = useSettingsStore();
  const streamUnsubscribe = useRef<(() => void) | null>(null);

  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    fetchAgents();
    fetchTemplates();
    resetGeneration();
  }, [fetchAgents, fetchTemplates, resetGeneration]);

  useEffect(() => {
    if (opId && !isStreaming && !streamContent) {
      streamUnsubscribe.current = startStream(opId);
      setShowResult(true);
    }
    return () => {
      streamUnsubscribe.current?.();
    };
  }, [opId, isStreaming, streamContent, startStream]);

  const handleGenerate = async () => {
    if (!selectedAgentId) return;
    resetGeneration();
    setShowResult(false);
    try {
      await generateDigest();
    } catch {
      // Error handled by store
    }
  };

  const handleRegenerate = () => {
    resetGeneration();
    setShowResult(false);
    handleGenerate();
  };

  if (showResult && (streamContent || streamError)) {
    return (
      <div className="space-y-4">
        <SSEStream content={streamContent} isStreaming={isStreaming} error={streamError} />
        {!isStreaming && streamContent && (
          <GenerationResult
            content={streamContent}
            onRegenerate={handleRegenerate}
          />
        )}
        <Button variant="ghost" onClick={() => { resetGeneration(); setShowResult(false); }}>
          Назад к настройкам
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Настройки дайджеста</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Агент</label>
          <Select value={selectedAgentId ?? undefined} onValueChange={setSelectedAgentId}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите агента" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Период</label>
          <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as 'day' | 'week' | 'month')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">День</SelectItem>
              <SelectItem value="week">Неделя</SelectItem>
              <SelectItem value="month">Месяц</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Шаблон</label>
          <Select
            value={selectedTemplateId ?? DEFAULT_TEMPLATE_VALUE}
            onValueChange={(value) => setSelectedTemplateId(value === DEFAULT_TEMPLATE_VALUE ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="По умолчанию" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_TEMPLATE_VALUE}>По умолчанию</SelectItem>
              {templates
                .filter((t) => t.type === 'digest')
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Провайдер</label>
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Модель</label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleGenerate}
          disabled={!selectedAgentId || isGenerating}
          loading={isGenerating}
        >
          {!isGenerating && <Sparkles className="h-4 w-4" />}
          Сгенерировать дайджест
        </Button>
      </CardContent>
    </Card>
  );
}
