import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { assetItems, assetPacks } from "../../db/schema.js";
import { AppError } from "../../middleware/error-handler.js";

const DEFAULT_EMOJI_ITEMS = [
  { name: "breaking", value: "🚨", label: "Breaking" },
  { name: "hot", value: "🔥", label: "Hot" },
  { name: "insight", value: "🧠", label: "Insight" },
  { name: "important", value: "📌", label: "Important" },
  { name: "stats", value: "📊", label: "Stats" },
  { name: "watch", value: "👀", label: "Watch" },
  { name: "action", value: "⚡", label: "Action" },
  { name: "done", value: "✅", label: "Done" },
];

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

async function ensureDefaultEmojiPack(workspaceId: string) {
  const existingDefault = await db.query.assetPacks.findFirst({
    where: and(eq(assetPacks.workspaceId, workspaceId), eq(assetPacks.isDefault, true)),
  });

  if (existingDefault) return existingDefault;

  const [createdPack] = await db
    .insert(assetPacks)
    .values({
      workspaceId,
      name: "Default Telegram Emoji Pack",
      description: "Дефолтный набор эмодзи для генерации постов в Telegram",
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
  await ensureDefaultEmojiPack(workspaceId);

  const pack = await db.query.assetPacks.findFirst({
    where: and(eq(assetPacks.workspaceId, workspaceId), eq(assetPacks.isDefault, true)),
  });

  if (!pack) return DEFAULT_EMOJI_ITEMS.map((item) => item.value);

  const items = await db
    .select({ value: assetItems.value })
    .from(assetItems)
    .where(and(eq(assetItems.packId, pack.id), eq(assetItems.type, "emoji")))
    .orderBy(asc(assetItems.position), asc(assetItems.createdAt));

  return items.length > 0 ? items.map((item) => item.value) : DEFAULT_EMOJI_ITEMS.map((item) => item.value);
}
