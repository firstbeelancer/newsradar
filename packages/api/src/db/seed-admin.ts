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

// AI providers to seed (only created if they don't exist for the workspace)
// API key is read from PLATFORM_AI_API_KEY env var at runtime
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
 * Also seeds default AI providers for the user's workspace.
 * Runs on every API startup — safe to call repeatedly (idempotent).
 */
export async function seedAdminUsers(): Promise<void> {
  for (const seed of SEED_USERS) {
    try {
      const existing = await db.query.users.findFirst({
        where: eq(users.email, seed.email),
      });

      let workspaceId: string | undefined;

      if (!existing) {
        // Create user + workspace
        const passwordHash = await bcrypt.hash(seed.password, SALT_ROUNDS);
        const [user] = await db
          .insert(users)
          .values({
            email: seed.email,
            passwordHash,
            name: seed.name,
          })
          .returning();

        // Ensure workspace exists
        const existingWorkspace = await db.query.workspaces.findFirst({
          where: eq(workspaces.userId, user.id),
        });

        if (!existingWorkspace) {
          const [ws] = await db.insert(workspaces).values({
            userId: user.id,
            name: `${seed.name} workspace`,
            plan: "free",
          }).returning();
          workspaceId = ws.id;
        } else {
          workspaceId = existingWorkspace.id;
        }

        console.log(`[seed] Created admin user: ${seed.email}`);
      } else {
        // Verify password matches
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

        // Get workspace ID
        const ws = await db.query.workspaces.findFirst({
          where: eq(workspaces.userId, existing.id),
        });
        workspaceId = ws?.id;
      }

      // Seed AI providers for this workspace
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
      // Read API key from environment variable
      const apiKeyPlain = process.env[provider.apiKeyEnvVar];
      if (!apiKeyPlain) {
        console.log(`[seed] Skipping AI provider ${provider.name}: env var ${provider.apiKeyEnvVar} not set`);
        continue;
      }

      // Check if provider already exists for this workspace
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

// ─── Default content templates ───

const DEFAULT_TEMPLATES = [
  {
    name: "Структурированный пост",
    type: "post" as const,
    systemPrompt: "Ты — профессиональный редактор новостного контента. Твоя задача — создать увлекательный пост на основе предоставленных новостных статей.\n\nПРАВИЛА:\n1. Пиши на русском языке\n2. Используй информативный, но доступный стиль\n3. Начинай с самого важного — ключевой факт или инсайт\n4. Подкрепляй утверждения конкретными данными из источников\n5. Добавляй контекст: почему это важно именно сейчас\n6. Завершай резюме или прогнозом\n\nСТРУКТУРА ПОСТА:\n- Заголовок (краткий, цепляющий)\n- Лид (1-2 предложения — суть новости)\n- Основная часть (факты, данные, цитаты)\n- Контекст и анализ\n- Вывод / прогноз",
    userPrompt: "На основе следующих статей создай структурированный пост:\n\n{{content}}",
    isDefault: true,
  },
  {
    name: "Краткий пост для соцсетей",
    type: "post" as const,
    systemPrompt: "Ты — SMM-копирайтер. Создай краткий, цепляющий пост для социальных сетей на основе новостных статей.\n\nПРАВИЛА:\n1. Пиши на русском языке\n2. Пост должен быть concise — до 500 символов\n3. Используй эмодзи для визуальной структуры (🔥💡📊⚡️)\n4. Начинай с хука — цепляющего факта или вопроса\n5. Добавляй 2-3 хештега в конце",
    userPrompt: "Создай краткий пост для соцсетей на основе этих новостей:\n\n{{content}}",
    isDefault: false,
  },
  {
    name: "Экспертный анализ",
    type: "post" as const,
    systemPrompt: "Ты — эксперт-аналитик в сфере технологий и бизнеса. Создай глубокий аналитический пост на основе предоставленных новостей.\n\nПРАВИЛА:\n1. Пиши на русском языке\n2. Глубокий анализ, а не пересказ\n3. Выявляй скрытые тренды и закономерности\n4. Формулируй прогнозы с обоснованием\n5. Указывай на риски и возможности\n\nСТРУКТУРА:\n- Контекст проблемы\n- Анализ ситуации\n- Тренды и закономерности\n- Прогноз развития\n- Рекомендации",
    userPrompt: "Подготовь экспертный анализ на основе этих новостей:\n\n{{content}}",
    isDefault: false,
  },
  {
    name: "Ежедневный дайджест",
    type: "digest" as const,
    systemPrompt: "Ты — профессиональный аналитик новостей. Твоя задача — подготовить структурированный дайджест на основе нескольких новостных статей по теме.\n\nПРАВИЛА:\n1. Пиши на русском языке\n2. Группируй новости по темам и значимости\n3. Для каждой темы: краткое резюме + ключевые факты + вывод\n4. Избегай дублирования — если несколько статей об одном, объединяй\n5. Добавляй аналитический контекст и прогнозы\n6. Указывай источники\n\nСТРУКТУРА ДАЙДЖЕСТА:\n- Заголовок дайджеста (тема + период)\n- Самое важное за период (3-5 ключевых событий)\n- Детальный разбор по темам\n- Тренды и закономерности\n- Прогноз и рекомендации",
    userPrompt: "Подготовь структурированный дайджест на основе этих статей:\n\n{{content}}",
    isDefault: true,
  },
  {
    name: "Краткий дайджест",
    type: "digest" as const,
    systemPrompt: "Ты — аналитик новостей. Создай краткий дайджест — только самое важное.\n\nПРАВИЛА:\n1. Пиши на русском языке\n2. Не более 1000 символов\n3. Только топ-3 новости с кратким описанием каждой\n4. Формат: буллет-пункты\n5. В конце — одно предложение прогноза",
    userPrompt: "Создай краткий дайджест из этих статей:\n\n{{content}}",
    isDefault: false,
  },
];

async function seedDefaultTemplates(workspaceId: string): Promise<void> {
  for (const tmpl of DEFAULT_TEMPLATES) {
    try {
      // Check if a template with the same name already exists for this workspace
      const existing = await db.query.contentTemplates.findFirst({
        where: and(
          eq(contentTemplates.workspaceId, workspaceId),
          eq(contentTemplates.name, tmpl.name),
        ),
      });

      if (!existing) {
        await db.insert(contentTemplates).values({
          name: tmpl.name,
          type: tmpl.type,
          systemPrompt: tmpl.systemPrompt,
          userPrompt: tmpl.userPrompt,
          isDefault: tmpl.isDefault,
          workspaceId,
        });
        console.log(`[seed] Created template: ${tmpl.name}`);
      } else {
        console.log(`[seed] Template already exists: ${tmpl.name}`);
      }
    } catch (err) {
      console.error(`[seed] Error seeding template ${tmpl.name}:`, err);
    }
  }
}
