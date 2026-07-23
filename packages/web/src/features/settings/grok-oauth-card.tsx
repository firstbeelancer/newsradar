import { useCallback, useEffect, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '@shared/api/client';
import { Card, CardContent } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Badge } from '@shared/ui/badge';
import { useToast } from '@shared/ui/toast';
import { Check, Copy, ExternalLink, Loader2, LogOut, Sparkles, Unplug } from 'lucide-react';

interface XaiOauthStatus {
  status: string;
  connected?: boolean;
  userCode?: string | null;
  verificationUri?: string | null;
  verificationUriComplete?: string | null;
  expiresAt?: string | null;
  connectedAt?: string | null;
  lastError?: string | null;
  model?: string;
  baseUrl?: string;
  waiting?: boolean;
  message?: string;
}

interface Props {
  onConnected?: () => void;
}

export function GrokOauthCard({ onConnected }: Props) {
  const { addToast } = useToast();
  const [status, setStatus] = useState<XaiOauthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    setPolling(false);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiGet<XaiOauthStatus>('/ai-providers/xai-oauth/status');
      setStatus(data);
      return data;
    } catch {
      setStatus({ status: 'disconnected', connected: false });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    return () => stopPolling();
  }, [loadStatus, stopPolling]);

  const handleStart = async () => {
    setBusy(true);
    stopPolling();
    try {
      const data = await apiPost<XaiOauthStatus>('/ai-providers/xai-oauth/start', {});
      setStatus({ ...data, connected: false, status: 'pending' });
      addToast({
        title: 'Код Grok готов',
        description: 'Открой ссылку, войди в SuperGrok / X Premium+ и подтверди код',
        variant: 'success',
      });
      // Auto-poll every 4s while pending
      setPolling(true);
      pollTimer.current = setInterval(() => {
        void handlePoll(true);
      }, 4000);
    } catch (err) {
      addToast({
        title: 'Не удалось начать OAuth',
        description: err instanceof Error ? err.message : 'Ошибка xAI',
        variant: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePoll = async (silent = false) => {
    try {
      const data = await apiPost<XaiOauthStatus & { waiting?: boolean }>('/ai-providers/xai-oauth/poll', {});
      setStatus(data);
      if (data.connected || data.status === 'connected') {
        stopPolling();
        addToast({
          title: 'Grok подключён',
          description: data.message || 'Подписка SuperGrok / X Premium+ активна для AI-агентов',
          variant: 'success',
        });
        onConnected?.();
      } else if (!silent && data.waiting) {
        addToast({
          title: 'Ждём подтверждение',
          description: 'Ещё не подтвердил код в браузере',
          variant: 'warning',
        });
      }
    } catch (err) {
      if (!silent) {
        addToast({
          title: 'Проверка не прошла',
          description: err instanceof Error ? err.message : 'Ошибка',
          variant: 'danger',
        });
      }
      // Keep polling on authorization_pending; stop on hard errors
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('истекло') || msg.includes('denied') || msg.includes('403')) {
        stopPolling();
        void loadStatus();
      }
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    stopPolling();
    try {
      await apiDelete('/ai-providers/xai-oauth');
      addToast({ title: 'Grok отключён', variant: 'success' });
      await loadStatus();
      onConnected?.();
    } catch (err) {
      addToast({
        title: 'Не удалось отключить',
        description: err instanceof Error ? err.message : '',
        variant: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!status?.userCode) return;
    try {
      await navigator.clipboard.writeText(status.userCode);
      addToast({ title: 'Код скопирован', variant: 'success' });
    } catch {
      /* ignore */
    }
  };

  const connected = Boolean(status?.connected || status?.status === 'connected');
  const pending = status?.status === 'pending';

  return (
    <Card className="overflow-hidden border-cyan-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white shadow-lg shadow-cyan-900/20">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950 shadow-md">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-bold tracking-tight">Grok по подписке</p>
                <p className="text-xs text-cyan-100/80">Как в Hermes: SuperGrok / X Premium+ · без API key billing</p>
              </div>
              {loading ? (
                <Badge className="bg-white/10 text-white">…</Badge>
              ) : connected ? (
                <Badge className="bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-300/30">
                  <Check className="mr-1 h-3 w-3" />
                  Подключён
                </Badge>
              ) : pending ? (
                <Badge className="bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/30">Ожидает вход</Badge>
              ) : (
                <Badge className="bg-white/10 text-white/80">Не подключён</Badge>
              )}
            </div>

            <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
              Device-code OAuth на accounts.x.ai. После входа токен хранится зашифрованным и используется
              worker’ом для перевода, скоринга, генерации и DeepSearch. Отдельный XAI_API_KEY не нужен.
            </p>

            {connected && (
              <div className="flex flex-wrap gap-2 text-xs text-cyan-100/90">
                <span className="rounded-full bg-white/10 px-2.5 py-1">model: {status?.model || 'grok-3-mini'}</span>
                {status?.connectedAt && (
                  <span className="rounded-full bg-white/10 px-2.5 py-1">
                    с {new Date(status.connectedAt).toLocaleString('ru-RU')}
                  </span>
                )}
              </div>
            )}

            {pending && status?.userCode && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-cyan-100/80">1. Открой ссылку и войди в Grok-аккаунт</p>
                <a
                  href={status.verificationUriComplete || status.verificationUri || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  {status.verificationUriComplete || status.verificationUri}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <p className="mt-3 text-xs text-cyan-100/80">2. Если спросят — введи код</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded-xl bg-black/30 px-3 py-1.5 font-mono text-lg font-bold tracking-[0.2em] text-white">
                    {status.userCode}
                  </code>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-white hover:bg-white/10"
                    onClick={copyCode}
                    title="Копировать код"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  После подтверждения в браузере нажми «Проверить вход» или подожди автопроверку.
                </p>
              </div>
            )}

            {status?.lastError && !connected && (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {status.lastError}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            {!connected ? (
              <>
                <Button
                  onClick={handleStart}
                  loading={busy}
                  className="bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 hover:from-cyan-300 hover:to-blue-400"
                >
                  <Sparkles className="h-4 w-4" />
                  {pending ? 'Получить новый код' : 'Подключить Grok'}
                </Button>
                {pending && (
                  <Button
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => void handlePoll(false)}
                    disabled={busy}
                  >
                    {polling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Проверить вход
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-rose-500/20"
                onClick={handleDisconnect}
                loading={busy}
              >
                <LogOut className="h-4 w-4" />
                Отключить
              </Button>
            )}
            <a
              href="https://x.ai/grok"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-cyan-200/70 hover:text-cyan-100"
            >
              <Unplug className="h-3 w-3" />
              x.ai/grok · подписка
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
