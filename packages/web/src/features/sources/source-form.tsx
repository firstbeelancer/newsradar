import { useState, useEffect } from 'react';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog';
import { Label } from '@shared/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select';
import { Switch } from '@shared/ui/switch';
import type { Source, CreateSourceDto, UpdateSourceDto } from '@shared/api/client';
import type { Agent } from '@shared/api/client';

const UNASSIGNED_AGENT = '__unassigned__';

interface SourceFormProps {
  source: Source | null;
  agents: Agent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateSourceDto | UpdateSourceDto) => Promise<void>;
  isSubmitting: boolean;
}

export function SourceForm({ source, agents, open, onOpenChange, onSubmit, isSubmitting }: SourceFormProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<'rss' | 'telegram' | 'web'>('rss');
  const [agentId, setAgentId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (source) {
      setName(source.name);
      setUrl(source.url);
      setType(source.type);
      setAgentId(source.agent_id || source.agents[0]?.id || UNASSIGNED_AGENT);
      setIsActive(source.is_active);
    } else {
      setName('');
      setUrl('');
      setType('rss');
      setAgentId(agents[0]?.id ?? '');
      setIsActive(true);
    }
    setErrors({});
  }, [source, open, agents]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Название обязательно';
    if (!url.trim()) newErrors.url = 'URL обязателен';
    if (!source && !agentId) newErrors.agentId = 'Выберите агента';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (source) {
      await onSubmit({
        agent_id: agentId === UNASSIGNED_AGENT ? null : agentId,
        name: name.trim(),
        url: url.trim(),
        type,
        isActive,
      });
    } else {
      await onSubmit({
        name: name.trim(),
        url: url.trim(),
        type,
        agent_id: agentId,
        isActive,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{source ? 'Редактировать источник' : 'Новый источник'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            placeholder="Например: TechCrunch RSS"
            required
          />

          <div className="space-y-1.5">
            <Label>Тип</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'rss' | 'telegram' | 'web')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rss">RSS</SelectItem>
                <SelectItem value="telegram">Telegram канал</SelectItem>
                <SelectItem value="web">Веб-страница (HTML)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Input
            label={type === 'rss' ? 'URL RSS-ленты' : type === 'telegram' ? 'Канал Telegram' : 'URL страницы новостей'}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={errors.url}
            placeholder={type === 'rss' ? 'https://example.com/feed.xml' : type === 'telegram' ? '@channelname' : 'https://example.com/news/'}
            required
          />

          <div className="space-y-1.5">
            <Label>Агент-владелец</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите агента" />
              </SelectTrigger>
              <SelectContent>
                {source && <SelectItem value={UNASSIGNED_AGENT}>Без агента</SelectItem>}
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Агент определяет, по каким ключевым словам и правилам будут оцениваться новости этого источника.
            </p>
            {errors.agentId && <p className="text-xs text-danger">{errors.agentId}</p>}
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label className="cursor-pointer">Активен</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {source ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
