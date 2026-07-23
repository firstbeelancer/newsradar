import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Card, CardContent } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Switch } from '@shared/ui/switch';
import { Skeleton } from '@shared/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu';
import {
  Bot, MoreVertical, Pencil, Trash2, Play, CircleDot, Link2, ChevronDown, ChevronUp,
  Rss, MessageCircle, Plus, Filter, Loader2, CheckCircle2, XCircle, Activity,
  Shield, Brain, Megaphone, Heart, Paintbrush, Globe, Zap, Star,
  Eye, Search, BookOpen, Target, Lightbulb, Compass, Newspaper,
  Hammer, Wrench, type LucideIcon,
} from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { agentsApi, sourcesApi, type Agent, type Source, type ChipFilter, type UpdateSourceDto } from '@shared/api/client';
import { SourceForm } from '../sources/source-form';

interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onCollect: (agent: Agent) => void;
  onSourceToggle?: (agentId: string, sourceId: string, isActive: boolean) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  bot: Bot,
  shield: Shield,
  brain: Brain,
  megaphone: Megaphone,
  heart: Heart,
  paintbrush: Paintbrush,
  globe: Globe,
  zap: Zap,
  star: Star,
  eye: Eye,
  search: Search,
  book: BookOpen,
  bookopen: BookOpen,
  rss: Rss,
  message: MessageCircle,
  messagecircle: MessageCircle,
  target: Target,
  lightbulb: Lightbulb,
  compass: Compass,
  newspaper: Newspaper,
  hammer: Hammer,
  wrench: Wrench,
};

function getAgentIcon(iconStr?: string): LucideIcon {
  if (!iconStr) return Bot;
  const key = iconStr.toLowerCase().replace(/[^a-z]/g, '');
  return ICON_MAP[key] || Bot;
}

function SourceToggleList({ agentId, onSourceDeleted }: { agentId: string; onSourceDeleted?: () => void }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkSummary, setCheckSummary] = useState<string | null>(null);
  const [probeById, setProbeById] = useState<
    Record<string, { success: boolean; message?: string; articles_found?: number }>
  >({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await agentsApi.sources(agentId);
        if (!cancelled) setSources(data);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [agentId]);

  const handleToggle = useCallback(async (sourceId: string, nextActive: boolean) => {
    setTogglingId(sourceId);
    try {
      await agentsApi.toggleSource(sourceId, nextActive);
      setSources(prev => prev.map(s => s.id === sourceId ? { ...s, is_active: nextActive } : s));
    } catch {
      // revert on error
    } finally {
      setTogglingId(null);
    }
  }, []);

  const handleDelete = useCallback(async (sourceId: string) => {
    setDeletingId(sourceId);
    try {
      await sourcesApi.delete(sourceId);
      setSources(prev => prev.filter(s => s.id !== sourceId));
      onSourceDeleted?.();
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  }, [onSourceDeleted]);

  const handleEditSubmit = useCallback(async (data: UpdateSourceDto) => {
    if (!editingSource) return;
    setSavingEdit(true);
    try {
      const updated = await sourcesApi.update(editingSource.id, data);
      setSources(prev => prev.map(s => s.id === updated.id ? updated : s));
      setEditingSource(null);
    } finally {
      setSavingEdit(false);
    }
  }, [editingSource]);

  const handleCheckSources = useCallback(async () => {
    setChecking(true);
    setCheckSummary(null);
    try {
      const result = await agentsApi.testSources(agentId);
      const map: Record<string, { success: boolean; message?: string; articles_found?: number }> = {};
      for (const row of result.results || []) {
        map[row.sourceId] = {
          success: row.success,
          message: row.message,
          articles_found: row.articles_found,
        };
      }
      setProbeById(map);
      setCheckSummary(result.summary);
    } catch (err) {
      setCheckSummary(err instanceof Error ? err.message : 'Не удалось проверить источники');
    } finally {
      setChecking(false);
    }
  }, [agentId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">Нет источников</p>
    );
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={() => void handleCheckSources()}
          disabled={checking}
        >
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
          {checking ? 'Проверяю…' : 'Проверить источники'}
        </Button>
        {checkSummary && (
          <span className="text-[11px] font-medium text-muted-foreground">{checkSummary}</span>
        )}
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
        {sources.map((source) => {
          const probe = probeById[source.id];
          return (
            <div
              key={source.id}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors group/src',
                probe
                  ? probe.success
                    ? 'bg-emerald-50/80 ring-1 ring-emerald-100'
                    : 'bg-rose-50/80 ring-1 ring-rose-100'
                  : source.is_active
                    ? 'bg-muted/40 hover:bg-muted/60'
                    : 'bg-muted/20 opacity-60 hover:opacity-80'
              )}
            >
              {/* Type icon */}
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground">
                {source.type === 'telegram' ? (
                  <MessageCircle className="h-3.5 w-3.5" />
                ) : (
                  <Rss className="h-3.5 w-3.5" />
                )}
              </div>

              {/* Name + URL + probe */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium truncate leading-tight">{source.name}</p>
                  {probe && (
                    probe.success ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="h-3 w-3 shrink-0 text-rose-600" />
                    )
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{source.url}</p>
                {probe?.message && (
                  <p
                    className={cn(
                      'mt-0.5 text-[10px] truncate',
                      probe.success ? 'text-emerald-700' : 'text-rose-700'
                    )}
                    title={probe.message}
                  >
                    {probe.success && probe.articles_found != null
                      ? `${probe.message}`
                      : probe.message}
                  </p>
                )}
              </div>

              {/* Edit button */}
              <button
                type="button"
                onClick={() => setEditingSource(source)}
                className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover/src:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent/10 text-muted-foreground hover:text-accent"
                title="Редактировать источник"
              >
                <Pencil className="h-3 w-3" />
              </button>

              {/* Toggle switch — standalone, NOT inside a <button> */}
              <Switch
                checked={source.is_active}
                onCheckedChange={(checked) => handleToggle(source.id, checked)}
                disabled={togglingId === source.id}
                className="shrink-0 scale-75"
              />

              {/* Delete button */}
              <button
                type="button"
                onClick={() => handleDelete(source.id)}
                disabled={deletingId === source.id}
                className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover/src:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                title="Удалить источник"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      <SourceForm
        source={editingSource}
        agents={[]}
        open={Boolean(editingSource)}
        onOpenChange={(open) => {
          if (!open) setEditingSource(null);
        }}
        onSubmit={(data) => handleEditSubmit(data as UpdateSourceDto)}
        isSubmitting={savingEdit}
      />
    </>
  );
}

function ChipFilterBadges({ agent }: { agent: Agent }) {
  const chipFilters: Partial<ChipFilter>[] = agent.chipFilters?.length
    ? agent.chipFilters
    : (agent.config?.chipFilters ?? []);

  if (chipFilters.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
      {chipFilters.filter(cf => cf.isActive !== false).slice(0, 5).map((cf) => (
        <span
          key={cf.key}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border border-border/60 bg-muted/40 text-muted-foreground"
        >
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: cf.color && cf.color !== 'default' ? cf.color : '#94a3b8' }}
          />
          {cf.label ?? cf.key}
        </span>
      ))}
      {chipFilters.filter(cf => cf.isActive !== false).length > 5 && (
        <span className="text-[10px] text-muted-foreground">
          +{chipFilters.filter(cf => cf.isActive !== false).length - 5}
        </span>
      )}
    </div>
  );
}

export function AgentCard({ agent, onEdit, onDelete, onCollect }: AgentCardProps) {
  const navigate = useNavigate();
  const AgentIcon = getAgentIcon(agent.icon);
  const agentColor = agent.color || '#0ea5e9';
  const isHex = agentColor.startsWith('#');
  const [sourcesOpen, setSourcesOpen] = useState(false);

  return (
    <Card className="group transition-all hover:shadow-md overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link
            to="/agents/$id"
            params={{ id: agent.id }}
            className={cn(
              'flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105'
            )}
            style={isHex ? { backgroundColor: `${agentColor}18`, color: agentColor } : undefined}
          >
            <AgentIcon className="h-5 w-5" />
          </Link>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to="/agents/$id"
                params={{ id: agent.id }}
                className="truncate text-sm font-semibold hover:text-accent transition-colors"
              >
                {agent.name}
              </Link>
              <Badge
                variant={agent.is_active ? 'success' : 'default'}
                className="shrink-0 text-[10px]"
              >
                {agent.is_active ? 'Активен' : 'Пауза'}
              </Badge>
            </div>

            {agent.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {agent.description}
              </p>
            )}

            {/* Chip Filters */}
            <ChipFilterBadges agent={agent} />

            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <CircleDot className="h-3 w-3" />
                {agent.article_count ?? 0} новостей
              </span>

              {/* Sources toggle — div, NOT button, to avoid nesting issues */}
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  setSourcesOpen(!sourcesOpen);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSourcesOpen(!sourcesOpen);
                  }
                }}
                className={cn(
                  'flex items-center gap-1.5 transition-colors cursor-pointer rounded-md px-2 py-1 -mx-2 -my-1 border select-none',
                  sourcesOpen
                    ? 'text-accent bg-accent/10 border-accent/30'
                    : 'text-muted-foreground hover:text-accent hover:bg-accent/5 border-transparent hover:border-accent/20'
                )}
              >
                <Link2 className="h-3 w-3" />
                <span>{agent.source_count ?? 0} источников</span>
                {sourcesOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onCollect(agent)}>
                <Play className="mr-2 h-4 w-4" />
                Собрать новости
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(agent)}>
                <Pencil className="mr-2 h-4 w-4" />
                Редактировать
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(agent)}
                className="text-danger focus:text-danger"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Sources panel */}
        {sourcesOpen && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-accent" />
                <p className="text-xs font-semibold text-foreground">Источники</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {agent.source_count ?? 0}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-accent hover:text-accent"
                onClick={() => navigate({ to: '/agents/$id', params: { id: agent.id } })}
              >
                <Plus className="h-3 w-3 mr-0.5" />
                Все источники
              </Button>
            </div>
            <SourceToggleList agentId={agent.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
