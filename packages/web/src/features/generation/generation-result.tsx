import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Textarea } from '@shared/ui/textarea';
import { Check, Copy, RotateCcw } from 'lucide-react';

interface GenerationResultProps {
  content: string;
  onRegenerate: () => void;
  onCopy?: () => void;
}

export function GenerationResult({ content, onRegenerate, onCopy }: GenerationResultProps) {
  const [editableContent, setEditableContent] = useState(content);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editableContent);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Результат</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Скопировано' : 'Копировать'}
            </Button>
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <RotateCcw className="h-4 w-4" />
              Заново
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={editableContent}
          onChange={(e) => setEditableContent(e.target.value)}
          rows={16}
          className="text-sm leading-relaxed resize-none"
        />
      </CardContent>
    </Card>
  );
}
