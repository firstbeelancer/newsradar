import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Badge } from '@shared/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/ui/dialog';
import { Cpu, Plus, Trash2, Check, Key } from 'lucide-react';

interface AIProvider {
  id: string;
  name: string;
  keyLabel: string;
  hasKey: boolean;
}

const DEFAULT_PROVIDERS: AIProvider[] = [
  { id: 'openai', name: 'OpenAI', keyLabel: 'OpenAI API Key', hasKey: false },
  { id: 'anthropic', name: 'Anthropic', keyLabel: 'Anthropic API Key', hasKey: false },
  { id: 'google', name: 'Google AI', keyLabel: 'Google API Key', hasKey: false },
];

export function AIProvidersSettings() {
  const [providers, setProviders] = useState<AIProvider[]>(DEFAULT_PROVIDERS);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [apiKey, setApiKey] = useState('');

  const handleAddKey = (provider: AIProvider) => {
    setSelectedProvider(provider);
    setApiKey('');
    setAddDialogOpen(true);
  };

  const handleSaveKey = () => {
    if (!selectedProvider || !apiKey.trim()) return;
    setProviders((prev) =>
      prev.map((p) => (p.id === selectedProvider.id ? { ...p, hasKey: true } : p))
    );
    setAddDialogOpen(false);
    setApiKey('');
  };

  const handleRemoveKey = (providerId: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, hasKey: false } : p))
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">AI провайдеры</h2>
        <p className="text-sm text-muted-foreground">Настройка ключей API для генерации контента</p>
      </div>

      <div className="space-y-3">
        {providers.map((provider) => (
          <Card key={provider.id} className="hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light text-accent">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{provider.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {provider.hasKey ? (
                        <Badge variant="success" className="text-[10px]">
                          <Check className="h-3 w-3 mr-1" />
                          Ключ настроен
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px]">
                          Ключ не настроен
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {provider.hasKey ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveKey(provider.id)}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddKey(provider)}
                    >
                      <Key className="h-4 w-4" />
                      Добавить ключ
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Key Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить ключ {selectedProvider?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              label={selectedProvider?.keyLabel || 'API Key'}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground">
              Ключ хранится в зашифрованном виде и используется только для генерации контента.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveKey} disabled={!apiKey.trim()}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
