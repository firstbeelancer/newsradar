import { useEffect, useMemo, useState } from 'react';
import { assetPacksApi, workspaceApi, type AssetPack, type WorkspaceConfig } from '@shared/api/client';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Textarea } from '@shared/ui/textarea';
import { useToast } from '@shared/ui/toast';
import { Check, MessageCircle, Sticker, SmilePlus } from 'lucide-react';

export function TelegramAssetsSettings() {
  const { addToast } = useToast();
  const [packs, setPacks] = useState<AssetPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [stickerPacks, setStickerPacks] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        const [assetPacks, workspace] = await Promise.all([assetPacksApi.list(), workspaceApi.get()]);
        setPacks(assetPacks);
        setSelectedPackId(assetPacks.find((pack) => pack.isDefault)?.id ?? assetPacks[0]?.id ?? null);
        setStickerPacks(((workspace.config.telegram?.stickerPacks as string[] | undefined) ?? []).join('\n'));
      } catch (error) {
        addToast({
          title: 'Не удалось загрузить Telegram-настройки',
          description: error instanceof Error ? error.message : 'Попробуй ещё раз',
          variant: 'danger',
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [addToast]);

  const selectedPack = useMemo(
    () => packs.find((pack) => pack.id === selectedPackId) ?? null,
    [packs, selectedPackId]
  );

  const handleSave = async () => {
    if (!selectedPackId) return;

    setIsSaving(true);
    try {
      await Promise.all([
        assetPacksApi.setDefault(selectedPackId),
        workspaceApi.updateConfig({
          telegram: {
            stickerPacks: stickerPacks
              .split('\n')
              .map((value) => value.trim())
              .filter(Boolean),
          },
        } as WorkspaceConfig),
      ]);

      setPacks((current) => current.map((pack) => ({ ...pack, isDefault: pack.id === selectedPackId })));
      addToast({
        title: 'Telegram-настройки сохранены',
        description: 'Дефолтный emoji pack и список sticker packs обновлены.',
        variant: 'success',
      });
    } catch (error) {
      addToast({
        title: 'Не удалось сохранить настройки',
        description: error instanceof Error ? error.message : 'Попробуй ещё раз',
        variant: 'danger',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Загружаю Telegram-настройки…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Emoji и sticker packs</h2>
        <p className="text-sm text-muted-foreground">
          Здесь задаётся дефолтный emoji pack для генерации и список sticker packs для ручной работы редактора.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SmilePlus className="h-5 w-5" />
            Emoji pack по умолчанию
          </CardTitle>
          <CardDescription>Именно этот набор будет использоваться при генерации Telegram-текстов.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {packs.map((pack) => {
            const isActive = pack.id === selectedPackId;
            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => setSelectedPackId(pack.id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  isActive ? 'border-accent bg-accent-light/20' : 'border-border hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{pack.name}</span>
                      {pack.isDefault && <span className="rounded-full bg-success-light px-2 py-0.5 text-xs text-success">Текущий default</span>}
                    </div>
                    {pack.description && <p className="text-xs text-muted-foreground">{pack.description}</p>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {pack.items.map((item) => (
                        <span key={item.id} className="rounded-lg bg-background px-2 py-1 text-lg">
                          {item.value}
                        </span>
                      ))}
                    </div>
                  </div>
                  {isActive && <Check className="h-5 w-5 text-accent" />}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sticker className="h-5 w-5" />
            Sticker packs
          </CardTitle>
          <CardDescription>По одной ссылке или названию на строку. Это рабочий список для редактора внутри настроек.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={stickerPacks}
            onChange={(event) => setStickerPacks(event.target.value)}
            rows={6}
            placeholder={'https://t.me/addstickers/example_pack\nhttps://t.me/addstickers/news_reactions'}
            className="resize-none text-sm leading-relaxed"
          />
          <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Стикеры пока не вставляются в текст автоматически. Здесь хранится удобный список паков, чтобы они были под рукой в редакторском контуре.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || !selectedPackId}>
          {isSaving ? 'Сохраняю...' : 'Сохранить Telegram-настройки'}
        </Button>
      </div>
    </div>
  );
}
