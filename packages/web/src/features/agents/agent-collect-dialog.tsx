import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog';
import { Button } from '@shared/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select';
import { Spinner } from '@shared/ui/spinner';
import type { Agent } from '@shared/api/client';
import { Zap, Check } from 'lucide-react';

interface AgentCollectDialogProps {
  agents: Agent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollect: (agentId: string) => Promise<string>;
}

export function AgentCollectDialog({ agents, open, onOpenChange, onCollect }: AgentCollectDialogProps) {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCollect = async () => {
    if (!selectedAgentId) return;
    setIsCollecting(true);
    setSuccess(false);
    try {
      await onCollect(selectedAgentId);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
      }, 1500);
    } catch {
      // Error handled by store
    } finally {
      setIsCollecting(false);
    }
  };

  const activeAgents = agents.filter((a) => a.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-warning" />
            Собрать новости
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {activeAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Нет активных агентов. Активируйте агента или создайте нового.
            </p>
          ) : (
            <>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите агента" />
                </SelectTrigger>
                <SelectContent>
                  {activeAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {success && (
                <div className="flex items-center gap-2 rounded-lg bg-success-light p-3 text-sm text-success">
                  <Check className="h-4 w-4" />
                  Сбор запущен успешно!
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isCollecting}>
            Отмена
          </Button>
          <Button
            onClick={handleCollect}
            disabled={!selectedAgentId || isCollecting || success}
            loading={isCollecting}
          >
            {!isCollecting && <Zap className="h-4 w-4" />}
            Запустить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
