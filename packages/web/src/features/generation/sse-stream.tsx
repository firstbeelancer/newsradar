import { Card, CardContent } from '@shared/ui/card';
import { Spinner } from '@shared/ui/spinner';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@shared/lib/utils';

interface SSEStreamProps {
  content: string;
  isStreaming: boolean;
  error: string | null;
}

export function SSEStream({ content, isStreaming, error }: SSEStreamProps) {
  if (!content && !isStreaming && !error) return null;

  return (
    <Card className="border-accent/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          {isStreaming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span className="text-accent">Генерация...</span>
            </>
          ) : error ? (
            <>
              <AlertCircle className="h-4 w-4 text-danger" />
              <span className="text-danger">Ошибка</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4 text-success" />
              <span className="text-success">Готово</span>
            </>
          )}
        </div>

        {content && (
          <div className="max-h-96 overflow-y-auto">
            <pre className={cn(
              'text-sm whitespace-pre-wrap break-words',
              'text-foreground leading-relaxed'
            )}>
              {content}
            </pre>
          </div>
        )}

        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
