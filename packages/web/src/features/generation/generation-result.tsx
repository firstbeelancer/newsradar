import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Textarea } from '@shared/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/ui/tooltip';
import { Check, Copy, Mic, MicOff, RotateCcw } from 'lucide-react';

interface GenerationResultProps {
  content: string;
  onRegenerate: (comments: string) => void;
  onCopy?: () => void;
}

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function GenerationResult({ content, onRegenerate, onCopy }: GenerationResultProps) {
  const [editableContent, setEditableContent] = useState(content);
  const [feedback, setFeedback] = useState('');
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);

  const SpeechRecognitionImpl = useMemo(
    () => (typeof window !== 'undefined' ? window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null : null),
    []
  );

  useEffect(() => {
    setEditableContent(content);
    setCopied(false);
    setSpeechError(null);
    setInterimTranscript('');
  }, [content]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editableContent);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = editableContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    setInterimTranscript('');
  };

  const startRecording = () => {
    if (!SpeechRecognitionImpl) {
      setSpeechError('Голосовой ввод не поддерживается в этом браузере');
      return;
    }

    if (isRecording) return;

    try {
      const recognition = new SpeechRecognitionImpl();
      recognition.lang = 'ru-RU';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';

        for (const result of Array.from(event.results)) {
          const transcript = result[0]?.transcript?.trim() ?? '';
          if (!transcript) continue;
          if (result.isFinal) {
            finalText = `${finalText} ${transcript}`.trim();
          } else {
            interimText = `${interimText} ${transcript}`.trim();
          }
        }

        if (finalText) {
          setFeedback((current) => `${current}${current ? '\n' : ''}${finalText}`.trim());
          setInterimTranscript('');
        } else {
          setInterimTranscript(interimText);
        }
      };
      recognition.onerror = (event) => {
        const denied = event?.error === 'not-allowed' || event?.error === 'service-not-allowed';
        setSpeechError(denied ? 'Браузер не дал доступ к микрофону' : 'Не удалось распознать голосовой комментарий');
        setIsRecording(false);
        setInterimTranscript('');
      };
      recognition.onend = () => {
        setIsRecording(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      setSpeechError(null);
      setInterimTranscript('');
      setIsRecording(true);
      recognition.start();
    } catch {
      setSpeechError('Не удалось запустить запись с микрофона');
      setIsRecording(false);
      setInterimTranscript('');
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    startRecording();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Готовый текст для Telegram</CardTitle>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Скопировано' : 'Копировать'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Текст уже подготовлен под Telegram. Можно сразу копировать или быстро подправить вручную.
          </p>
          <Textarea
            value={editableContent}
            onChange={(event) => setEditableContent(event.target.value)}
            rows={16}
            className="resize-none text-sm leading-relaxed"
          />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm font-medium">Комментарии к перегенерации</label>
            <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isRecording ? 'danger' : 'outline'}
                      size="icon-sm"
                      aria-pressed={isRecording}
                      aria-label={isRecording ? 'Остановить запись' : 'Начать запись'}
                      onClick={toggleRecording}
                    >
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isRecording ? 'Нажми ещё раз, чтобы остановить запись' : 'Нажми, чтобы начать запись'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button size="sm" onClick={() => onRegenerate(feedback)} disabled={!feedback.trim()}>
                <RotateCcw className="h-4 w-4" />
                Перегенерировать
              </Button>
            </div>
          </div>

          {isRecording && (
            <div className="flex items-center gap-3 rounded-xl border border-danger/20 bg-danger-light px-3 py-2 text-xs text-danger">
              <span className="font-medium">Идёт запись</span>
              <div className="flex h-5 items-center gap-1" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
                  <span
                    key={bar}
                    className="w-1 rounded-full bg-danger/80 animate-pulse"
                    style={{
                      height: `${8 + ((bar * 7) % 13)}px`,
                      animationDelay: `${bar * 90}ms`,
                    }}
                  />
                ))}
              </div>
              {interimTranscript && <span className="min-w-0 truncate text-danger/80">{interimTranscript}</span>}
            </div>
          )}

          <Textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            rows={5}
            placeholder="Напиши, что поменять: тон, длину, акцент, структуру, стиль, факты, финальный вывод."
            className="resize-none text-sm leading-relaxed"
          />
          {speechError && <p className="text-xs text-danger">{speechError}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
