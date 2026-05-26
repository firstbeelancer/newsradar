import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { assetItems, assetPacks } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";
import { DEFAULT_EMOJI_ITEMS, normalizeEmojiValues } from "./defaults.js";

export interface AssetPackDto {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  itemCount: number;
  items: Array<{
    id: string;
    type: string;
    name: string;
    value: string;
    label: string | null;
    position: number;
  }>;
}

export interface EmojiPromptItem {
  name: string;
  value: string;
  label: string | null;
}

async function ensureDefaultEmojiPack(workspaceId: string) {
  const existingDefault = await db.query.assetPacks.findFirst({
    where: and(eq(assetPacks.workspaceId, workspaceId), eq(assetPacks.isDefault, true)),
  });

  if (existingDefault) {
    if (existingDefault.name === "Default Telegram Emoji Pack") {
      await ensureDefaultItems(existingDefault.id);
    }
    return existingDefault;
  }

  const [createdPack] = await db
    .insert(assetPacks)
    .values({
      workspaceId,
      name: "Default Telegram Emoji Pack",
      description: "Дефолтный расширенный набор emoji для генерации постов в Telegram",
      isDefault: true,
      itemCount: DEFAULT_EMOJI_ITEMS.length,
    })
    .returning();

  await db.insert(assetItems).values(
    DEFAULT_EMOJI_ITEMS.map((item, index) => ({
      packId: createdPack.id,
      type: "emoji",
      name: item.name,
      value: item.value,
      label: item.label,
      position: index,
    }))
  );

  return createdPack;
}

async function ensureDefaultItems(packId: string) {
  const existingItems = await db
    .select({ name: assetItems.name })
    .from(assetItems)
    .where(and(eq(assetItems.packId, packId), eq(assetItems.type, "emoji")));
  const existingNames = new Set(existingItems.map((item) => item.name));
  const missing = DEFAULT_EMOJI_ITEMS.filter((item) => !existingNames.has(item.name));

  if (missing.length > 0) {
    await db.insert(assetItems).values(
      missing.map((item, index) => ({
        packId,
        type: "emoji",
        name: item.name,
        value: item.value,
        label: item.label,
        position: existingItems.length + index,
      }))
    );
  }

  await db
    .update(assetPacks)
    .set({ itemCount: existingItems.length + missing.length, updatedAt: new Date() })
    .where(eq(assetPacks.id, packId));
}

export async function createAssetPack(
  workspaceId: string,
  data: { name: string; description?: string | null; emojis: string[] | string; setDefault?: boolean }
) {
  const emojis = normalizeEmojiValues(data.emojis);
  if (emojis.length === 0) {
    throw new AppError(400, "Emoji pack must contain at least one emoji", "ASSET_PACK_EMPTY");
  }

  const [createdPack] = await db
    .insert(assetPacks)
    .values({
      workspaceId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      isDefault: false,
      itemCount: emojis.length,
    })
    .returning();

  await db.insert(assetItems).values(
    emojis.map((emoji, index) => ({
      packId: createdPack.id,
      type: "emoji",
      name: `emoji_${index + 1}`,
      value: emoji,
      label: emoji,
      position: index,
    }))
  );

  if (data.setDefault) {
    return setDefaultAssetPack(workspaceId, createdPack.id);
  }

  return createdPack;
}

export async function listAssetPacks(workspaceId: string): Promise<AssetPackDto[]> {
  await ensureDefaultEmojiPack(workspaceId);

  const packs = await db
    .select()
    .from(assetPacks)
    .where(eq(assetPacks.workspaceId, workspaceId))
    .orderBy(asc(assetPacks.createdAt));

  if (packs.length === 0) return [];

  const items = await db
    .select()
    .from(assetItems)
    .where(and(eq(assetItems.type, "emoji"), inArray(assetItems.packId, packs.map((pack) => pack.id))))
    .orderBy(asc(assetItems.position), asc(assetItems.createdAt));

  return packs.map((pack) => ({
    id: pack.id,
    name: pack.name,
    description: pack.description,
    isDefault: pack.isDefault,
    itemCount: pack.itemCount,
    items: items
      .filter((item) => item.packId === pack.id)
      .map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
        value: item.value,
        label: item.label,
        position: item.position,
      })),
  }));
}

export async function setDefaultAssetPack(workspaceId: string, packId: string) {
  const pack = await db.query.assetPacks.findFirst({
    where: and(eq(assetPacks.id, packId), eq(assetPacks.workspaceId, workspaceId)),
  });

  if (!pack) {
    throw new AppError(404, "Asset pack not found", "ASSET_PACK_NOT_FOUND");
  }

  await db
    .update(assetPacks)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(assetPacks.workspaceId, workspaceId));

  const [updated] = await db
    .update(assetPacks)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(assetPacks.id, packId))
    .returning();

  return updated;
}

export async function getDefaultEmojiValues(workspaceId: string): Promise<string[]> {
  return (await getDefaultEmojiItems(workspaceId)).map((item) => item.value);
}

export async function getDefaultEmojiItems(workspaceId: string): Promise<EmojiPromptItem[]> {
  await ensureDefaultEmojiPack(workspaceId);

  const pack = await db.query.assetPacks.findFirst({
    where: and(eq(assetPacks.workspaceId, workspaceId), eq(assetPacks.isDefault, true)),
  });

  if (!pack) return DEFAULT_EMOJI_ITEMS.map((item) => ({ ...item, label: item.label ?? null }));

  const items = await db
    .select({ name: assetItems.name, value: assetItems.value, label: assetItems.label })
    .from(assetItems)
    .where(and(eq(assetItems.packId, pack.id), eq(assetItems.type, "emoji")))
    .orderBy(asc(assetItems.position), asc(assetItems.createdAt));

  return items.length > 0
    ? items
    : DEFAULT_EMOJI_ITEMS.map((item) => ({ ...item, label: item.label ?? null }));
}
