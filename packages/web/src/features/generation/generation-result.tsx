import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Textarea } from '@shared/ui/textarea';
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
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
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
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);

  const SpeechRecognitionImpl = useMemo(
    () => (typeof window !== 'undefined' ? window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null : null),
    []
  );

  useEffect(() => {
    setEditableContent(content);
    setCopied(false);
    setSpeechError(null);
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

  const toggleRecording = () => {
    if (!SpeechRecognitionImpl) {
      setSpeechError('Голосовой ввод не поддерживается в этом браузере');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();

      if (transcript) {
        setFeedback((current) => `${current}${current ? '\n' : ''}${transcript}`.trim());
      }
    };
    recognition.onerror = () => {
      setSpeechError('Не удалось распознать голосовой комментарий');
      setIsRecording(false);
    };
    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    setSpeechError(null);
    setIsRecording(true);
    recognition.start();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Готовый текст для Telegram</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Скопировано' : 'Копировать'}
            </Button>
            <Button size="sm" onClick={() => onRegenerate(feedback)} disabled={!feedback.trim()}>
              <RotateCcw className="h-4 w-4" />
              Перегенерировать
            </Button>
          </div>
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
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium">Комментарии к перегенерации</label>
            <Button variant="outline" size="sm" onClick={toggleRecording}>
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {isRecording ? 'Стоп запись' : 'Наговорить'}
            </Button>
          </div>
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
