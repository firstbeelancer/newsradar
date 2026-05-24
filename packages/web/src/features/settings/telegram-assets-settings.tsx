import { useEffect, useState } from 'react';
import { assetPacksApi, workspaceApi, type AssetPack, type WorkspaceConfig } from '@shared/api/client';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Textarea } from '@shared/ui/textarea';
import { useToast } from '@shared/ui/toast';
import { Check, MessageCircle, Plus, Sticker, SmilePlus } from 'lucide-react';

function parseStickerPackLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function TelegramAssetsSettings() {
  const { addToast } = useToast();
  const [packs, setPacks] = useState<AssetPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [stickerPacks, setStickerPacks] = useState('');
  const [customPackName, setCustomPackName] = useState('');
  const [customEmojiText, setCustomEmojiText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingPack, setIsCreatingPack] = useState(false);
  const [customPackDialogOpen, setCustomPackDialogOpen] = useState(false);

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
          description: error instanceof Error ? error.message : 'Попробуй еще раз',
          variant: 'danger',
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [addToast]);

  const saveTelegramSettings = async (defaultPackId: string) => {
    if (!defaultPackId) return;

    setIsSaving(true);
    try {
      await Promise.all([
        assetPacksApi.setDefault(defaultPackId),
        workspaceApi.updateConfig({
          telegram: {
            stickerPacks: parseStickerPackLines(stickerPacks),
          },
        } as WorkspaceConfig),
      ]);

      setSelectedPackId(defaultPackId);
      setPacks((current) => current.map((pack) => ({ ...pack, isDefault: pack.id === defaultPackId })));
      addToast({
        title: 'Telegram-настройки сохранены',
        description: 'Дефолтный emoji pack и список sticker packs обновлены.',
        variant: 'success',
      });
    } catch (error) {
      addToast({
        title: 'Не удалось сохранить настройки',
        description: error instanceof Error ? error.message : 'Попробуй еще раз',
        variant: 'danger',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPackId) return;
    await saveTelegramSettings(selectedPackId);
  };

  const handleCreatePack = async () => {
    const name = customPackName.trim();
    const emojis = customEmojiText.trim();

    if (!name || !emojis) {
      addToast({
        title: 'Заполни название и эмодзи',
        description: 'Вставь сами emoji через пробелы, запятые или с новой строки.',
        variant: 'warning',
      });
      return;
    }

    setIsCreatingPack(true);
    try {
      await assetPacksApi.create({
        name,
        description: 'Пользовательский emoji pack для генерации Telegram-текстов',
        emojis,
        setDefault: true,
      });
      const refreshedPacks = await assetPacksApi.list();
      setPacks(refreshedPacks);
      setSelectedPackId(refreshedPacks.find((pack) => pack.isDefault)?.id ?? refreshedPacks[0]?.id ?? null);
      setCustomPackName('');
      setCustomEmojiText('');
      setCustomPackDialogOpen(false);
      addToast({
        title: 'Emoji pack создан',
        description: 'Новый набор сразу выбран как default для генерации.',
        variant: 'success',
      });
    } catch (error) {
      addToast({
        title: 'Не удалось создать emoji pack',
        description: error instanceof Error ? error.message : 'Попробуй еще раз',
        variant: 'danger',
      });
    } finally {
      setIsCreatingPack(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Загружаю Telegram-настройки...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Emoji и sticker packs</h2>
        <p className="text-sm text-muted-foreground">
          Здесь задается default emoji pack для генерации и список sticker packs для ручной работы редактора.
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
              <div
                key={pack.id}
                onClick={() => setSelectedPackId(pack.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedPackId(pack.id);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  isActive ? 'border-accent bg-accent-light/20' : 'border-border hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{pack.name}</span>
                      {pack.isDefault && (
                        <span className="rounded-full bg-success-light px-2 py-0.5 text-xs text-success">
                          Текущий default
                        </span>
                      )}
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
                  <div className="flex shrink-0 items-center gap-2">
                    {!pack.isDefault && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isSaving}
                        onClick={(event) => {
                          event.stopPropagation();
                          void saveTelegramSettings(pack.id);
                        }}
                      >
                        Сделать default
                      </Button>
                    )}
                    {isActive && <Check className="h-5 w-5 text-accent" />}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-5 w-5" />
            Свой emoji pack для генерации
          </CardTitle>
          <CardDescription>
            Вставь сюда сами emoji из Telegram-набора. Ссылка на sticker pack хранится отдельно и не превращается в emoji автоматически.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">Кастомные emoji в модалке</p>
              <p className="text-xs text-muted-foreground">
                Открой модалку и вставь обычные emoji, кастомные символы или короткие токены.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setCustomPackDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Открыть
            </Button>
          </div>
          <Input
            value={customPackName}
            onChange={(event) => setCustomPackName(event.target.value)}
            placeholder="Например: Tech pastel"
          />
          <Textarea
            value={customEmojiText}
            onChange={(event) => setCustomEmojiText(event.target.value)}
            rows={4}
            placeholder="🚨 🔥 🧠 📌 📊 👀 ⚡ ✅"
            className="resize-none text-lg leading-relaxed"
          />
          <div className="flex justify-end">
            <Button type="button" onClick={handleCreatePack} disabled={isCreatingPack}>
              <Plus className="h-4 w-4" />
              {isCreatingPack ? 'Создаю...' : 'Создать и сделать default'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sticker className="h-5 w-5" />
            Sticker packs
          </CardTitle>
          <CardDescription>
            По одной ссылке или названию на строку. Это рабочий список для редактора внутри настроек.
          </CardDescription>
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
            <p>
              Sticker pack пока не вставляется в текст автоматически. Для генерации используется выбранный выше emoji pack;
              ссылки здесь нужны как быстрый справочник для ручной работы.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || !selectedPackId}>
          {isSaving ? 'Сохраняю...' : 'Сохранить Telegram-настройки'}
        </Button>
      </div>
      <Dialog open={customPackDialogOpen} onOpenChange={setCustomPackDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Свой emoji pack</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={customPackName}
              onChange={(event) => setCustomPackName(event.target.value)}
              placeholder="Например: Cyber neon"
            />
            <Textarea
              value={customEmojiText}
              onChange={(event) => setCustomEmojiText(event.target.value)}
              rows={6}
              placeholder={'🔥 🚨 🧠 📌\n:custom_ai: :custom_alert:'}
              className="resize-none text-lg leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              Разделяй значения пробелами, запятыми или строками. После создания набор сразу станет default для генерации.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCustomPackDialogOpen(false)} disabled={isCreatingPack}>
              Отмена
            </Button>
            <Button type="button" onClick={handleCreatePack} disabled={isCreatingPack}>
              <Plus className="h-4 w-4" />
              {isCreatingPack ? 'Создаю...' : 'Создать и сделать default'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
