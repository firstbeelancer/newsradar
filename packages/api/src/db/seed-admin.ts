import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "./index.js";
import { users, workspaces, aiProviders, contentTemplates } from "./schema.js";
import { encrypt } from "../lib/encryption.js";

const SALT_ROUNDS = 12;

interface SeedUser {
  email: string;
  password: string;
  name: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: "firstbeelancer@gmail.com",
    password: "firstbeelancer",
    name: "firstbeelancer",
  },
];

// AI providers to seed (only created if they don't exist for the workspace).
// API key is read from PLATFORM_AI_API_KEY env var at runtime.
const SEED_AI_PROVIDERS = [
  {
    name: "OpenRouter Owl Alpha",
    type: "byok" as const,
    provider: "openrouter" as const,
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnvVar: "PLATFORM_AI_API_KEY",
    model: "openrouter/owl-alpha",
  },
];

/**
 * Ensures that seed users exist in the database with correct passwords.
 * Also seeds default AI providers and editorial templates for the user's workspace.
 * Runs on every API startup and is safe to call repeatedly.
 */
export async function seedAdminUsers(): Promise<void> {
  for (const seed of SEED_USERS) {
    try {
      const existing = await db.query.users.findFirst({
        where: eq(users.email, seed.email),
      });

      let workspaceId: string | undefined;

      if (!existing) {
        const passwordHash = await bcrypt.hash(seed.password, SALT_ROUNDS);
        const [user] = await db
          .insert(users)
          .values({
            email: seed.email,
            passwordHash,
            name: seed.name,
          })
          .returning();

        const existingWorkspace = await db.query.workspaces.findFirst({
          where: eq(workspaces.userId, user.id),
        });

        if (!existingWorkspace) {
          const [ws] = await db
            .insert(workspaces)
            .values({
              userId: user.id,
              name: `${seed.name} workspace`,
              plan: "free",
            })
            .returning();
          workspaceId = ws.id;
        } else {
          workspaceId = existingWorkspace.id;
        }

        console.log(`[seed] Created admin user: ${seed.email}`);
      } else {
        const valid = await bcrypt.compare(seed.password, existing.passwordHash ?? "");
        if (!valid) {
          const passwordHash = await bcrypt.hash(seed.password, SALT_ROUNDS);
          await db
            .update(users)
            .set({ passwordHash, name: seed.name })
            .where(eq(users.email, seed.email));
          console.log(`[seed] Updated password for: ${seed.email}`);
        } else {
          console.log(`[seed] Admin user OK: ${seed.email}`);
        }

        const ws = await db.query.workspaces.findFirst({
          where: eq(workspaces.userId, existing.id),
        });
        workspaceId = ws?.id;
      }

      if (workspaceId) {
        await seedAIProviders(workspaceId);
        await seedDefaultTemplates(workspaceId);
      }
    } catch (err) {
      console.error(`[seed] Error seeding user ${seed.email}:`, err);
    }
  }
}

async function seedAIProviders(workspaceId: string): Promise<void> {
  for (const provider of SEED_AI_PROVIDERS) {
    try {
      const apiKeyPlain = process.env[provider.apiKeyEnvVar];
      if (!apiKeyPlain) {
        console.log(`[seed] Skipping AI provider ${provider.name}: env var ${provider.apiKeyEnvVar} not set`);
        continue;
      }

      const existing = await db.query.aiProviders.findFirst({
        where: and(
          eq(aiProviders.workspaceId, workspaceId),
          eq(aiProviders.provider, provider.provider),
          eq(aiProviders.model, provider.model),
        ),
      });

      if (!existing) {
        await db.insert(aiProviders).values({
          name: provider.name,
          type: provider.type,
          provider: provider.provider,
          baseUrl: provider.baseUrl,
          apiKeyEncrypted: encrypt(apiKeyPlain),
          model: provider.model,
          isActive: true,
          workspaceId,
        });
        console.log(`[seed] Created AI provider: ${provider.name}`);
      } else {
        console.log(`[seed] AI provider already exists: ${provider.name}`);
      }
    } catch (err) {
      console.error(`[seed] Error seeding AI provider ${provider.name}:`, err);
    }
  }
}

type TemplateType = "post" | "digest";

interface SeedTemplate {
  name: string;
  type: TemplateType;
  systemPrompt: string;
  userPrompt: string;
  description: string;
  isDefault: boolean;
  aliases: string[];
}

const DEFAULT_TEMPLATES: SeedTemplate[] = [
  {
    name: "Ежедневный дайджест",
    type: "digest",
    description: "Универсальный дайджест по вручную выбранным новостям за любой период.",
    isDefault: true,
    aliases: ["Дайджест дня", "Краткий дайджест"],
    systemPrompt: `Ты — редактор-аналитик Newsradar. Пользователь вручную выбрал новости для дайджеста, поэтому не придумывай период и не называй материал ежедневным, если по датам видно, что подборка шире одного дня.

Задача: собрать связный русскоязычный дайджест для Telegram/мессенджера на основе выбранных материалов.

Правила:
1. Пиши только на русском языке.
2. Не пересказывай каждую статью механически: сгруппируй материалы по темам, убери дубли и повторы.
3. Покажи главное: что произошло, почему это важно, кому это важно и что может быть дальше.
4. Не выдумывай факты, цифры, CVE, цитаты, источники и ссылки.
5. Если в исходных материалах есть ссылки, добавь короткий блок "Источники".
6. Если статья на иностранном языке, используй русский перевод смысла, но не теряй оригинальные имена продуктов, компаний и технологий.
7. Эмодзи и sticker placeholders используй только если они переданы в контексте генерации; не вставляй случайные украшения.

Структура:
- Заголовок дайджеста.
- 3-7 главных пунктов, сгруппированных по смыслу.
- Короткий аналитический вывод: общий тренд или риск.
- Источники, если ссылки доступны.`,
    userPrompt: `Собери дайджест по выбранным материалам.

Материалы:
{{content}}

Сделай итоговый текст готовым к ручной публикации: без markdown-разметки, без служебных комментариев, без упоминания промта.`,
  },
  {
    name: "Отчёт по уязвимостям",
    type: "post",
    description: "Практический отчёт по уязвимостям, инцидентам и ИБ-рискам.",
    isDefault: false,
    aliases: ["Отчет по уязвимостям"],
    systemPrompt: `Ты — аналитик по информационной безопасности. Твоя задача — превратить новость об уязвимости, атаке, кампании или защитной мере в практический отчёт для технической аудитории.

Правила:
1. Пиши на русском языке.
2. Не выдумывай CVE, CVSS, версии, вендоров, индикаторы компрометации и способы эксплуатации.
3. Если данных нет, прямо пиши: "в источнике не указано".
4. Разделяй подтверждённые факты, выводы и рекомендации.
5. Если есть ссылка на оригинал, обязательно добавь её в конце.
6. Не превращай отчёт в кликбейт. Тон: спокойный, инженерный, полезный.
7. Эмодзи и sticker placeholders используй только если они переданы в контексте генерации.

Структура:
- Что произошло.
- Что затронуто: продукт, версия, платформа, вендор, CVE/CVSS, если указаны.
- Какой риск и для кого.
- Что делать: обновление, workaround, мониторинг, проверка логов.
- Что пока неизвестно.
- Источник.`,
    userPrompt: `Подготовь отчёт по уязвимости или ИБ-событию на основе материала.

Материал:
{{content}}

Если новость не про уязвимость, всё равно сделай ИБ-разбор: риск, контекст, практические действия и источник.`,
  },
  {
    name: "Экспертный анализ",
    type: "post",
    description: "Структурированный экспертный пост: факт, контекст, значение, последствия.",
    isDefault: true,
    aliases: ["Структурированный пост", "Подробный анализ", "AI-подборка", "Краткий пост для соцсетей"],
    systemPrompt: `Ты — сильный редактор и эксперт-аналитик Newsradar. Делай не пересказ, а структурированный экспертный пост по выбранной новости.

Задача: объяснить читателю, что произошло, почему это важно и какие последствия возможны.

Правила:
1. Пиши только на русском языке.
2. Не выдумывай факты, ссылки, цитаты, статистику и причинно-следственные связи.
3. Сохраняй точные имена компаний, продуктов, моделей, технологий и людей.
4. Если пользователь в комментарии просит изменить стиль, теги, ссылку, тональность или структуру — выполни это как приоритетную редакторскую правку.
5. Если есть ссылка на оригинал, добавь её в конце.
6. Хештеги добавляй только если пользователь попросил или если это явно уместно для соцсетей.
7. Эмодзи и sticker placeholders используй только если они переданы в контексте генерации; не выбирай их наугад.

Базовая структура:
- Сильный заголовок без кликбейта.
- Суть новости в 1-2 предложениях.
- Контекст: почему это важно сейчас.
- Разбор: последствия, риски, возможности или ограничения.
- Что дальше: вероятный следующий шаг или вопрос, за которым стоит следить.
- Источник, если ссылка доступна.`,
    userPrompt: `Сделай структурированный экспертный пост по материалу.

Материал:
{{content}}

Итог должен быть готов для ручной публикации в Telegram/мессенджере: без markdown-мусора, без служебных пояснений, без фраз вроде "вот пост".`,
  },
];

const LEGACY_TEMPLATE_NAMES = new Set(DEFAULT_TEMPLATES.flatMap((template) => template.aliases));

const OLD_SEED_PROMPT_MARKERS = [
  "профессиональный редактор новостного контента",
  "SMM-копирайтер",
  "эксперт-аналитик в сфере технологий и бизнеса",
  "профессиональный аналитик новостей",
  "Создай краткий дайджест",
  "структурированный пост",
  "краткий пост для соцсетей",
  "глубокий аналитический пост",
  "Рџ",
  "Рў",
  "Рќ",
  "РЎ",
  "Рё",
  "СЃ",
  "С‚",
  "вЂ",
];

function shouldRefreshSeedPrompt(value: string | null | undefined): boolean {
  const text = value?.trim();
  if (!text || text === "{{content}}" || text.length < 40) {
    return true;
  }

  const lower = text.toLowerCase();
  return OLD_SEED_PROMPT_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
}

async function seedDefaultTemplates(workspaceId: string): Promise<void> {
  const existingTemplates = await db.query.contentTemplates.findMany({
    where: eq(contentTemplates.workspaceId, workspaceId),
  });
  const keptIds = new Set<string>();

  for (const tmpl of DEFAULT_TEMPLATES) {
    try {
      const existing =
        existingTemplates.find((template) => template.name === tmpl.name) ??
        existingTemplates.find((template) => tmpl.aliases.includes(template.name) && !keptIds.has(template.id));

      if (!existing) {
        const [created] = await db
          .insert(contentTemplates)
          .values({
            name: tmpl.name,
            type: tmpl.type,
            systemPrompt: tmpl.systemPrompt,
            userPrompt: tmpl.userPrompt,
            description: tmpl.description,
            isDefault: tmpl.isDefault,
            workspaceId,
          })
          .returning();
        keptIds.add(created.id);
        console.log(`[seed] Created template: ${tmpl.name}`);
        continue;
      }

      const updateData = {
        name: tmpl.name,
        type: tmpl.type,
        description: existing.description ?? tmpl.description,
        isDefault: tmpl.isDefault,
        systemPrompt: shouldRefreshSeedPrompt(existing.systemPrompt) ? tmpl.systemPrompt : existing.systemPrompt,
        userPrompt: shouldRefreshSeedPrompt(existing.userPrompt) ? tmpl.userPrompt : existing.userPrompt,
        updatedAt: new Date(),
      };

      await db.update(contentTemplates).set(updateData).where(eq(contentTemplates.id, existing.id));
      keptIds.add(existing.id);
      console.log(`[seed] Template OK: ${tmpl.name}`);
    } catch (err) {
      console.error(`[seed] Error seeding template ${tmpl.name}:`, err);
    }
  }

  for (const template of existingTemplates) {
    if (keptIds.has(template.id) || !LEGACY_TEMPLATE_NAMES.has(template.name)) {
      continue;
    }

    await db.delete(contentTemplates).where(eq(contentTemplates.id, template.id));
    console.log(`[seed] Removed legacy template: ${template.name}`);
  }
}
