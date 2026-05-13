import { useState } from 'react';
import { Button } from '@shared/ui/button';
import { Badge } from '@shared/ui/badge';
import { Spinner } from '@shared/ui/spinner';
import { useSourcesStore } from '@shared/stores/sources-store';
import { TestTube, Check, X } from 'lucide-react';
import { cn } from '@shared/lib/utils';

interface SourceTestButtonProps {
  sourceId: string;
}

export function SourceTestButton({ sourceId }: SourceTestButtonProps) {
  const { testSource, isTesting, testResult, clearTestResult } = useSourcesStore();
  const [showDetails, setShowDetails] = useState(false);

  const handleTest = async () => {
    clearTestResult();
    setShowDetails(true);
    await testSource(sourceId);
  };

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleTest}
        loading={isTesting}
        disabled={isTesting}
      >
        {!isTesting && <TestTube className="h-4 w-4" />}
        {isTesting ? 'Тестирование...' : 'Тест'}
      </Button>

      {showDetails && testResult && (
        <div className={cn(
          'rounded-lg border p-3 text-sm',
          testResult.success
            ? 'border-success/30 bg-success-light text-success'
            : 'border-danger/30 bg-danger-light text-danger'
        )}>
          <div className="flex items-center gap-2 mb-1">
            {testResult.success ? (
              <Check className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
            <span className="font-medium">
              {testResult.success ? 'Успешно' : 'Ошибка'}
            </span>
          </div>
          <p className="text-xs opacity-90">{testResult.message}</p>
          {testResult.articles_found !== undefined && (
            <p className="text-xs mt-1">
              Найдено статей: <Badge variant="outline" className="text-[10px]">{testResult.articles_found}</Badge>
            </p>
          )}
          {testResult.sample_titles && testResult.sample_titles.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium mb-1">Примеры заголовков:</p>
              <ul className="space-y-0.5">
                {testResult.sample_titles.map((title, i) => (
                  <li key={i} className="text-xs opacity-80 truncate">• {title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
